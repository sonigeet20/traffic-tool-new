# Deploying Headful Browser Configuration

## For Current Running Instances

### Option 1: AWS Systems Manager Run Command (Recommended)

1. **Upload SSM Document**:
```bash
aws ssm create-document \
  --name "DeployHeadfulBrowser" \
  --document-type "Command" \
  --content file://ssm-deploy-headful.json
```

2. **Run on All Instances**:
```bash
# Get instance IDs with tag Name=traffic-tool
INSTANCE_IDS=$(aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=traffic-tool" "Name=instance-state-name,Values=running" \
  --query "Reservations[].Instances[].InstanceId" \
  --output text)

# Execute deployment
aws ssm send-command \
  --document-name "DeployHeadfulBrowser" \
  --instance-ids $INSTANCE_IDS \
  --comment "Deploy headful browser configuration"
```

3. **Check Status**:
```bash
aws ssm list-command-invocations \
  --command-id <command-id-from-above> \
  --details
```

### Option 2: Direct SSH Deployment

```bash
# Copy script to all instances
for IP in $(aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=traffic-tool" "Name=instance-state-name,Values=running" \
  --query "Reservations[].Instances[].PublicIpAddress" \
  --output text); do
    
    echo "Deploying to $IP..."
    scp -i your-key.pem deploy-headful-to-instances.sh ubuntu@$IP:/tmp/
    ssh -i your-key.pem ubuntu@$IP 'bash /tmp/deploy-headful-to-instances.sh'
done
```

### Option 3: Manual per Instance

```bash
# SSH into each instance
ssh -i your-key.pem ubuntu@<instance-ip>

# Run deployment script
curl -fsSL https://raw.githubusercontent.com/geet-sketch/traffic-tool/main/deploy-headful-to-instances.sh | bash
```

## For Future Instances

### Update Launch Template

1. **AWS Console**:
   - Go to EC2 → Launch Templates
   - Select your template
   - Actions → Modify template (Create new version)
   - Advanced details → User data
   - Paste contents of `user-data-headful.sh`
   - Create template version
   - Set as default version

2. **AWS CLI**:
```bash
aws ec2 create-launch-template-version \
  --launch-template-id lt-xxxxx \
  --source-version 1 \
  --launch-template-data file://launch-template-data.json
```

### Update Auto Scaling Group

```bash
aws autoscaling update-auto-scaling-group \
  --auto-scaling-group-name traffic-tool-asg \
  --launch-template LaunchTemplateId=lt-xxxxx,Version='$Latest'
```

### Create New AMI with Configuration

```bash
# SSH into a configured instance
ssh -i your-key.pem ubuntu@<configured-instance-ip>

# Verify configuration
pm2 list
ps aux | grep Xvfb

# Create AMI from AWS Console or CLI:
aws ec2 create-image \
  --instance-id i-xxxxx \
  --name "traffic-tool-headful-$(date +%Y%m%d)" \
  --description "Traffic tool with headful browser support"
```

## Verification

After deployment, verify on each instance:

```bash
# Check Xvfb is running
ps aux | grep Xvfb | grep -v grep

# Check DISPLAY variable
echo $DISPLAY

# Check pm2 status
pm2 list

# Test browser launch
pm2 logs app --lines 50
```

## Rollback

If issues occur:

```bash
# Stop and revert to headless
pm2 stop app
pkill -f "Xvfb :99"

# Start without DISPLAY
pm2 start server.cjs --name app --interpreter node
pm2 save
```

## Monitoring

```bash
# Watch logs
pm2 logs app

# Monitor resources
pm2 monit

# Check Xvfb memory usage
ps aux | grep Xvfb
```

## Troubleshooting

### "Display :99 already in use"
```bash
pkill -f "Xvfb :99"
sleep 2
# Restart Xvfb
```

### PM2 not persisting DISPLAY
```bash
# Edit pm2 ecosystem file
pm2 ecosystem
# Add: env: { DISPLAY: ':99' }
```

### Browser still launching headless
Check server.cjs uses `headless: false` and verify DISPLAY is set in pm2:
```bash
pm2 env app | grep DISPLAY
```
