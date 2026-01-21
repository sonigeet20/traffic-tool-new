# AWS Load Balancer + Auto Scaling Group Implementation Plan
## Traffic Tool Infrastructure (us-east-1)

**⚠️ CRITICAL: Zero-Impact Deployment**
- Current server: `13.218.100.97` (EC2 instance in us-east-1)
- Existing tools in us-east-1 MUST NOT be affected
- All new resources will have unique names with `traffic-tool-` prefix
- No modifications to existing VPC, security groups, or instances

---

## Phase 1: Infrastructure Assessment & Preparation

### 1.1 Current State Discovery (READ-ONLY)
```bash
# SSH into current instance
ssh -i ~/Downloads/browser-automation-key.pem ubuntu@13.218.100.97

# Collect instance metadata
INSTANCE_ID=$(ec2-metadata --instance-id | cut -d ' ' -f 2)
VPC_ID=$(ec2-metadata --vpc-id | cut -d ' ' -f 2)
SUBNET_ID=$(ec2-metadata --subnet-id | cut -d ' ' -f 2)
SECURITY_GROUP=$(curl -s http://169.254.169.254/latest/meta-data/security-groups)
AZ=$(ec2-metadata --availability-zone | cut -d ' ' -f 2)

echo "Instance ID: $INSTANCE_ID"
echo "VPC ID: $VPC_ID"
echo "Subnet ID: $SUBNET_ID"
echo "Security Group: $SECURITY_GROUP"
echo "Availability Zone: $AZ"
```

### 1.2 AWS CLI Discovery (From Local Machine)
```bash
# Set region
export AWS_REGION=us-east-1

# Find the current instance details
aws ec2 describe-instances \
  --filters "Name=ip-address,Values=13.218.100.97" \
  --query 'Reservations[0].Instances[0].[InstanceId,VpcId,SubnetId,SecurityGroups[0].GroupId,InstanceType,KeyName]' \
  --output text

# List all VPCs (to avoid conflicts)
aws ec2 describe-vpcs --region us-east-1 --output table

# List existing load balancers (to avoid name conflicts)
aws elbv2 describe-load-balancers --region us-east-1 --output table

# List existing target groups (to avoid conflicts)
aws elbv2 describe-target-groups --region us-east-1 --output table

# List existing Auto Scaling Groups (to avoid conflicts)
aws autoscaling describe-auto-scaling-groups --region us-east-1 --output table
```

**✅ Save all outputs to reference file: `aws-current-state.txt`**

---

## Phase 2: AMI Creation (Snapshot Current Server)

### 2.1 Create AMI from Current Instance
```bash
# From local machine (replace INSTANCE_ID with actual value)
INSTANCE_ID="i-xxxxxxxxxxxxxxxxx"  # From Phase 1

# Create AMI (no downtime)
aws ec2 create-image \
  --instance-id $INSTANCE_ID \
  --name "traffic-tool-server-$(date +%Y%m%d-%H%M%S)" \
  --description "Traffic Tool Server - Puppeteer + Intelligent Traffic Module" \
  --no-reboot \
  --region us-east-1 \
  --output json > ami-creation-output.json

# Get AMI ID
AMI_ID=$(jq -r '.ImageId' ami-creation-output.json)
echo "AMI ID: $AMI_ID"

# Wait for AMI to be available
aws ec2 wait image-available --image-ids $AMI_ID --region us-east-1
echo "✅ AMI Ready: $AMI_ID"
```

### 2.2 Tag AMI for Organization
```bash
aws ec2 create-tags \
  --resources $AMI_ID \
  --tags \
    Key=Name,Value=traffic-tool-server \
    Key=Environment,Value=production \
    Key=Service,Value=traffic-generation \
    Key=CreatedBy,Value=automation \
  --region us-east-1
```

---

## Phase 3: Security Groups (New, Isolated)

### 3.1 Create ALB Security Group
```bash
# Get VPC ID from Phase 1
VPC_ID="vpc-xxxxxxxxxxxxxxxxx"

# Create ALB security group (allows HTTP/HTTPS from internet)
aws ec2 create-security-group \
  --group-name traffic-tool-alb-sg \
  --description "Security group for Traffic Tool ALB" \
  --vpc-id $VPC_ID \
  --region us-east-1 \
  --output json > alb-sg-output.json

ALB_SG_ID=$(jq -r '.GroupId' alb-sg-output.json)
echo "ALB Security Group: $ALB_SG_ID"

# Allow HTTP from anywhere
aws ec2 authorize-security-group-ingress \
  --group-id $ALB_SG_ID \
  --protocol tcp \
  --port 80 \
  --cidr 0.0.0.0/0 \
  --region us-east-1

# Allow port 3000 from anywhere (backend API)
aws ec2 authorize-security-group-ingress \
  --group-id $ALB_SG_ID \
  --protocol tcp \
  --port 3000 \
  --cidr 0.0.0.0/0 \
  --region us-east-1

# Tag it
aws ec2 create-tags \
  --resources $ALB_SG_ID \
  --tags Key=Name,Value=traffic-tool-alb-sg \
  --region us-east-1
```

### 3.2 Create ASG Instance Security Group
```bash
# Create instance security group (allows traffic from ALB + SSH)
aws ec2 create-security-group \
  --group-name traffic-tool-instances-sg \
  --description "Security group for Traffic Tool ASG instances" \
  --vpc-id $VPC_ID \
  --region us-east-1 \
  --output json > instance-sg-output.json

INSTANCE_SG_ID=$(jq -r '.GroupId' instance-sg-output.json)
echo "Instance Security Group: $INSTANCE_SG_ID"

# Allow port 3000 from ALB only
aws ec2 authorize-security-group-ingress \
  --group-id $INSTANCE_SG_ID \
  --protocol tcp \
  --port 3000 \
  --source-group $ALB_SG_ID \
  --region us-east-1

# Allow SSH from your IP (replace with your IP)
YOUR_IP="0.0.0.0/0"  # Replace with actual IP for security
aws ec2 authorize-security-group-ingress \
  --group-id $INSTANCE_SG_ID \
  --protocol tcp \
  --port 22 \
  --cidr $YOUR_IP \
  --region us-east-1

# Tag it
aws ec2 create-tags \
  --resources $INSTANCE_SG_ID \
  --tags Key=Name,Value=traffic-tool-instances-sg \
  --region us-east-1
```

---

## Phase 4: Target Group Creation

### 4.1 Create Target Group
```bash
# Create target group for port 3000
aws elbv2 create-target-group \
  --name traffic-tool-tg \
  --protocol HTTP \
  --port 3000 \
  --vpc-id $VPC_ID \
  --health-check-enabled \
  --health-check-protocol HTTP \
  --health-check-path / \
  --health-check-interval-seconds 30 \
  --health-check-timeout-seconds 5 \
  --healthy-threshold-count 2 \
  --unhealthy-threshold-count 3 \
  --matcher HttpCode=200 \
  --target-type instance \
  --region us-east-1 \
  --output json > target-group-output.json

TG_ARN=$(jq -r '.TargetGroups[0].TargetGroupArn' target-group-output.json)
echo "Target Group ARN: $TG_ARN"

# Add tags
aws elbv2 add-tags \
  --resource-arns $TG_ARN \
  --tags Key=Name,Value=traffic-tool-tg Key=Service,Value=traffic-generation \
  --region us-east-1
```

### 4.2 Configure Target Group Attributes
```bash
# Enable stickiness for session persistence
aws elbv2 modify-target-group-attributes \
  --target-group-arn $TG_ARN \
  --attributes \
    Key=stickiness.enabled,Value=true \
    Key=stickiness.type,Value=lb_cookie \
    Key=stickiness.lb_cookie.duration_seconds,Value=3600 \
    Key=deregistration_delay.timeout_seconds,Value=30 \
  --region us-east-1
```

---

## Phase 5: Application Load Balancer Creation

### 5.1 Get Subnets (Minimum 2 AZs Required)
```bash
# List available subnets in VPC
aws ec2 describe-subnets \
  --filters "Name=vpc-id,Values=$VPC_ID" \
  --query 'Subnets[*].[SubnetId,AvailabilityZone,CidrBlock]' \
  --region us-east-1 \
  --output table

# Select 2+ subnets in different AZs
SUBNET_1="subnet-xxxxxxxxxxxxxxxxx"  # AZ: us-east-1a
SUBNET_2="subnet-yyyyyyyyyyyyyyyyy"  # AZ: us-east-1b
```

### 5.2 Create Application Load Balancer
```bash
aws elbv2 create-load-balancer \
  --name traffic-tool-alb \
  --subnets $SUBNET_1 $SUBNET_2 \
  --security-groups $ALB_SG_ID \
  --scheme internet-facing \
  --type application \
  --ip-address-type ipv4 \
  --tags Key=Name,Value=traffic-tool-alb Key=Service,Value=traffic-generation \
  --region us-east-1 \
  --output json > alb-output.json

ALB_ARN=$(jq -r '.LoadBalancers[0].LoadBalancerArn' alb-output.json)
ALB_DNS=$(jq -r '.LoadBalancers[0].DNSName' alb-output.json)
echo "ALB ARN: $ALB_ARN"
echo "ALB DNS: $ALB_DNS"
```

### 5.3 Create Listener (Port 3000)
```bash
aws elbv2 create-listener \
  --load-balancer-arn $ALB_ARN \
  --protocol HTTP \
  --port 3000 \
  --default-actions Type=forward,TargetGroupArn=$TG_ARN \
  --region us-east-1 \
  --output json > listener-output.json

LISTENER_ARN=$(jq -r '.Listeners[0].ListenerArn' listener-output.json)
echo "Listener ARN: $LISTENER_ARN"
```

---

## Phase 6: Launch Template Creation

### 6.1 Create Launch Template
```bash
# Get key pair name from current instance
KEY_NAME=$(aws ec2 describe-instances \
  --instance-ids $INSTANCE_ID \
  --query 'Reservations[0].Instances[0].KeyName' \
  --output text \
  --region us-east-1)

# Create launch template with user data
cat > user-data.sh <<'EOF'
#!/bin/bash
set -e

# Wait for cloud-init to finish
cloud-init status --wait

# Ensure PM2 starts on boot
sudo -u ubuntu bash -c "pm2 startup systemd -u ubuntu --hp /home/ubuntu"
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu

# Start server if not running
cd /home/ubuntu/puppeteer-server
sudo -u ubuntu bash -c "pm2 start server.js --name server || pm2 restart server"
sudo -u ubuntu bash -c "pm2 save"

# Enable PM2 resurrection
sudo systemctl enable pm2-ubuntu

echo "✅ Instance initialization complete"
EOF

# Base64 encode user data
USER_DATA_BASE64=$(base64 -i user-data.sh)

# Create launch template
aws ec2 create-launch-template \
  --launch-template-name traffic-tool-lt \
  --version-description "Traffic Tool Launch Template v1" \
  --launch-template-data "{
    \"ImageId\": \"$AMI_ID\",
    \"InstanceType\": \"t3.large\",
    \"KeyName\": \"$KEY_NAME\",
    \"SecurityGroupIds\": [\"$INSTANCE_SG_ID\"],
    \"UserData\": \"$USER_DATA_BASE64\",
    \"IamInstanceProfile\": {
      \"Name\": \"EC2DefaultRole\"
    },
    \"TagSpecifications\": [
      {
        \"ResourceType\": \"instance\",
        \"Tags\": [
          {\"Key\": \"Name\", \"Value\": \"traffic-tool-asg-instance\"},
          {\"Key\": \"Service\", \"Value\": \"traffic-generation\"},
          {\"Key\": \"ManagedBy\", \"Value\": \"ASG\"}
        ]
      }
    ],
    \"Monitoring\": {
      \"Enabled\": true
    }
  }" \
  --region us-east-1 \
  --output json > launch-template-output.json

LT_ID=$(jq -r '.LaunchTemplate.LaunchTemplateId' launch-template-output.json)
echo "Launch Template ID: $LT_ID"
```

---

## Phase 7: Auto Scaling Group Creation

### 7.1 Create Auto Scaling Group
```bash
aws autoscaling create-auto-scaling-group \
  --auto-scaling-group-name traffic-tool-asg \
  --launch-template LaunchTemplateId=$LT_ID,Version='$Latest' \
  --min-size 2 \
  --max-size 10 \
  --desired-capacity 2 \
  --default-cooldown 300 \
  --health-check-type ELB \
  --health-check-grace-period 300 \
  --vpc-zone-identifier "$SUBNET_1,$SUBNET_2" \
  --target-group-arns $TG_ARN \
  --tags \
    Key=Name,Value=traffic-tool-asg-instance,PropagateAtLaunch=true \
    Key=Service,Value=traffic-generation,PropagateAtLaunch=true \
  --region us-east-1

echo "✅ Auto Scaling Group created: traffic-tool-asg"
```

### 7.2 Configure Scaling Policies

#### CPU-Based Scaling
```bash
# Scale UP policy (CPU > 70%)
aws autoscaling put-scaling-policy \
  --auto-scaling-group-name traffic-tool-asg \
  --policy-name traffic-tool-scale-up \
  --policy-type TargetTrackingScaling \
  --target-tracking-configuration "{
    \"PredefinedMetricSpecification\": {
      \"PredefinedMetricType\": \"ASGAverageCPUUtilization\"
    },
    \"TargetValue\": 70.0
  }" \
  --region us-east-1 \
  --output json > scale-up-policy.json

# Scale DOWN policy (automatic with target tracking)
echo "✅ Target tracking policy will scale down automatically when CPU < 70%"
```

#### Request Count-Based Scaling
```bash
# Scale based on ALB request count per target
aws autoscaling put-scaling-policy \
  --auto-scaling-group-name traffic-tool-asg \
  --policy-name traffic-tool-scale-requests \
  --policy-type TargetTrackingScaling \
  --target-tracking-configuration "{
    \"PredefinedMetricSpecification\": {
      \"PredefinedMetricType\": \"ALBRequestCountPerTarget\",
      \"ResourceLabel\": \"$(echo $ALB_ARN | cut -d: -f6)/$(echo $TG_ARN | cut -d: -f6)\"
    },
    \"TargetValue\": 1000.0
  }" \
  --region us-east-1 \
  --output json > scale-requests-policy.json

echo "✅ Request count scaling policy created"
```

---

## Phase 8: CloudWatch Monitoring & Alarms

### 8.1 Create CloudWatch Dashboard
```bash
cat > dashboard-config.json <<EOF
{
  "widgets": [
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/ApplicationELB", "TargetResponseTime", {"stat": "Average"}],
          [".", "RequestCount", {"stat": "Sum"}],
          [".", "HTTPCode_Target_2XX_Count", {"stat": "Sum"}],
          [".", "HTTPCode_Target_5XX_Count", {"stat": "Sum"}]
        ],
        "period": 300,
        "stat": "Average",
        "region": "us-east-1",
        "title": "ALB Metrics",
        "yAxis": {
          "left": {
            "min": 0
          }
        }
      }
    },
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/EC2", "CPUUtilization", {"stat": "Average"}],
          [".", "NetworkIn", {"stat": "Sum"}],
          [".", "NetworkOut", {"stat": "Sum"}]
        ],
        "period": 300,
        "stat": "Average",
        "region": "us-east-1",
        "title": "ASG Instance Metrics"
      }
    }
  ]
}
EOF

aws cloudwatch put-dashboard \
  --dashboard-name traffic-tool-dashboard \
  --dashboard-body file://dashboard-config.json \
  --region us-east-1

echo "✅ CloudWatch Dashboard created"
```

### 8.2 Create Alarms
```bash
# High CPU alarm
aws cloudwatch put-metric-alarm \
  --alarm-name traffic-tool-high-cpu \
  --alarm-description "Alert when ASG CPU > 90%" \
  --metric-name CPUUtilization \
  --namespace AWS/EC2 \
  --statistic Average \
  --period 300 \
  --threshold 90 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --region us-east-1

# Target unhealthy alarm
aws cloudwatch put-metric-alarm \
  --alarm-name traffic-tool-unhealthy-targets \
  --alarm-description "Alert when unhealthy target count > 0" \
  --metric-name UnHealthyHostCount \
  --namespace AWS/ApplicationELB \
  --statistic Average \
  --period 60 \
  --threshold 1 \
  --comparison-operator GreaterThanOrEqualToThreshold \
  --evaluation-periods 2 \
  --dimensions Name=TargetGroup,Value=$(echo $TG_ARN | cut -d: -f6) \
  --region us-east-1

echo "✅ CloudWatch Alarms created"
```

---

## Phase 9: Testing & Validation

### 9.1 Health Check Validation
```bash
# Check ALB status
aws elbv2 describe-load-balancers \
  --load-balancer-arns $ALB_ARN \
  --query 'LoadBalancers[0].State' \
  --region us-east-1

# Check target health
aws elbv2 describe-target-health \
  --target-group-arn $TG_ARN \
  --region us-east-1 \
  --output table

# Test endpoint
curl -v http://$ALB_DNS:3000/
```

### 9.2 Load Testing
```bash
# Install Apache Bench if not available
# brew install httpd (macOS)
# sudo apt-get install apache2-utils (Ubuntu)

# Simple load test (100 requests, 10 concurrent)
ab -n 100 -c 10 http://$ALB_DNS:3000/

# Extended load test (watch ASG scale)
ab -n 10000 -c 50 -t 300 http://$ALB_DNS:3000/
```

### 9.3 Monitor Scaling Events
```bash
# Watch ASG scaling activities
watch -n 5 "aws autoscaling describe-scaling-activities \
  --auto-scaling-group-name traffic-tool-asg \
  --max-records 5 \
  --region us-east-1 \
  --output table"

# Watch instance count
watch -n 5 "aws autoscaling describe-auto-scaling-groups \
  --auto-scaling-group-names traffic-tool-asg \
  --query 'AutoScalingGroups[0].[MinSize,DesiredCapacity,MaxSize,Instances[*].HealthStatus]' \
  --region us-east-1"
```

---

## Phase 10: Frontend Update (Optional - Use ALB DNS)

### 10.1 Update CampaignDetails.tsx
```typescript
// Replace hardcoded IP with ALB DNS
// Before: http://13.218.100.97:3000/api/automate
// After:  http://<ALB_DNS>:3000/api/automate

// In CampaignDetails.tsx, line ~353:
fetch(`http://${ALB_DNS}:3000/api/automate`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
})
```

### 10.2 Environment Variable Approach
```bash
# Add to .env
VITE_TRAFFIC_API_URL=http://<ALB_DNS>:3000

# Use in code
fetch(`${import.meta.env.VITE_TRAFFIC_API_URL}/api/automate`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
})
```

---

## Phase 11: Cleanup Original Instance (AFTER VALIDATION)

### ⚠️ Only After 48 Hours of Stable Operation

```bash
# Stop original instance (reversible)
aws ec2 stop-instances --instance-ids $INSTANCE_ID --region us-east-1

# Wait 1 week, if no issues, terminate
aws ec2 terminate-instances --instance-ids $INSTANCE_ID --region us-east-1
```

---

## Cost Estimation

### Current Setup (Single t3.large)
- **EC2 Instance**: ~$0.0832/hour = ~$60/month
- **Data Transfer**: ~$0.09/GB (first 10TB)

### New Setup (ALB + ASG with 2-10 instances)
- **ALB**: ~$0.0225/hour + $0.008/LCU-hour = ~$25-35/month
- **EC2 Instances** (2-10 × t3.large): ~$120-600/month
- **Data Transfer**: ~$0.09/GB (first 10TB)
- **CloudWatch**: ~$3/month (basic monitoring)

**Total Estimated Cost**: $150-640/month (scales with load)

**💰 Cost Savings**: 50% reduction per instance vs t3.xlarge

---

## Rollback Plan

### If Issues Occur:
1. **Immediate**: Point frontend back to `13.218.100.97:3000`
2. **Remove new traffic**: Delete Route 53 record or update frontend
3. **Scale down ASG**: Set desired capacity to 0
4. **Investigate**: Check CloudWatch logs and target health
5. **Keep original instance running** until 100% confidence

### Rollback Commands:
```bash
# Scale down ASG immediately
aws autoscaling set-desired-capacity \
  --auto-scaling-group-name traffic-tool-asg \
  --desired-capacity 0 \
  --region us-east-1

# Delete ASG (if needed)
aws autoscaling delete-auto-scaling-group \
  --auto-scaling-group-name traffic-tool-asg \
  --force-delete \
  --region us-east-1
```

---

## Summary Checklist

- [ ] Phase 1: Collect current instance metadata
- [ ] Phase 2: Create AMI from current instance
- [ ] Phase 3: Create new security groups (no conflicts)
- [ ] Phase 4: Create target group
- [ ] Phase 5: Create ALB with 2+ subnets
- [ ] Phase 6: Create launch template with user data
- [ ] Phase 7: Create ASG (min=2, max=10)
- [ ] Phase 8: Set up CloudWatch dashboard & alarms
- [ ] Phase 9: Test health checks and load
- [ ] Phase 10: Update frontend to use ALB DNS
- [ ] Phase 11: Monitor 48hrs → Stop original instance → Wait 1 week → Terminate

**🎯 Final DNS Endpoint**: `http://<ALB_DNS>:3000`

---

## Emergency Contacts & Resources

- **Current Instance IP**: `13.218.100.97`
- **SSH Key**: `~/Downloads/browser-automation-key.pem`
- **Region**: `us-east-1` (N. Virginia)
- **Service**: Traffic Generation Tool (Puppeteer Server)
- **Critical Path**: `/home/ubuntu/puppeteer-server/server.js`

**⚠️ GOLDEN RULE**: Keep original instance running until NEW infrastructure is battle-tested for at least 48 hours.
