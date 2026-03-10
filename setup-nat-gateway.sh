#!/bin/bash

# AWS NAT Gateway Setup for Single IP Whitelisting
# This script sets up a NAT Gateway to provide a single static IP for all outbound traffic

echo "🌐 Setting up NAT Gateway for single IP whitelisting..."
echo ""

# Get the current VPC and subnet info
INSTANCE_ID="i-0a234bcd5e678f901"  # Replace with actual instance ID
VPC_ID=$(aws ec2 describe-instances --instance-ids $INSTANCE_ID --query 'Reservations[0].Instances[0].VpcId' --output text)
SUBNET_ID=$(aws ec2 describe-instances --instance-ids $INSTANCE_ID --query 'Reservations[0].Instances[0].SubnetId' --output text)
REGION="us-east-1"

echo "📋 Current Infrastructure:"
echo "   VPC ID: $VPC_ID"
echo "   Subnet ID: $SUBNET_ID"
echo "   Region: $REGION"
echo ""

# Step 1: Allocate Elastic IP for NAT Gateway
echo "1️⃣  Allocating Elastic IP..."
EIP_ALLOC=$(aws ec2 allocate-address --domain vpc --region $REGION --output json)
ALLOCATION_ID=$(echo $EIP_ALLOC | jq -r '.AllocationId')
NAT_GATEWAY_IP=$(echo $EIP_ALLOC | jq -r '.PublicIp')

echo "   ✅ Elastic IP allocated: $NAT_GATEWAY_IP"
echo "   Allocation ID: $ALLOCATION_ID"
echo ""

# Step 2: Create public subnet for NAT Gateway (if not exists)
echo "2️⃣  Creating public subnet for NAT Gateway..."
PUBLIC_SUBNET=$(aws ec2 create-subnet \
  --vpc-id $VPC_ID \
  --cidr-block 10.0.1.0/24 \
  --availability-zone us-east-1a \
  --region $REGION \
  --output json)

PUBLIC_SUBNET_ID=$(echo $PUBLIC_SUBNET | jq -r '.Subnet.SubnetId')
echo "   ✅ Public subnet created: $PUBLIC_SUBNET_ID"
echo ""

# Step 3: Create Internet Gateway (if not exists)
echo "3️⃣  Creating Internet Gateway..."
IGW=$(aws ec2 create-internet-gateway --region $REGION --output json)
IGW_ID=$(echo $IGW | jq -r '.InternetGateway.InternetGatewayId')

aws ec2 attach-internet-gateway \
  --vpc-id $VPC_ID \
  --internet-gateway-id $IGW_ID \
  --region $REGION

echo "   ✅ Internet Gateway created and attached: $IGW_ID"
echo ""

# Step 4: Create NAT Gateway
echo "4️⃣  Creating NAT Gateway (this takes 2-5 minutes)..."
NAT_GW=$(aws ec2 create-nat-gateway \
  --subnet-id $PUBLIC_SUBNET_ID \
  --allocation-id $ALLOCATION_ID \
  --region $REGION \
  --output json)

NAT_GATEWAY_ID=$(echo $NAT_GW | jq -r '.NatGateway.NatGatewayId')
echo "   ✅ NAT Gateway creation initiated: $NAT_GATEWAY_ID"
echo "   ⏳ Waiting for NAT Gateway to become available..."

aws ec2 wait nat-gateway-available --nat-gateway-ids $NAT_GATEWAY_ID --region $REGION
echo "   ✅ NAT Gateway is now available!"
echo ""

# Step 5: Update route tables
echo "5️⃣  Updating route tables..."

# Get private subnet route table
PRIVATE_RT_ID=$(aws ec2 describe-route-tables \
  --filters "Name=association.subnet-id,Values=$SUBNET_ID" \
  --query 'RouteTables[0].RouteTableId' \
  --region $REGION \
  --output text)

# Add route to NAT Gateway for private subnet
aws ec2 create-route \
  --route-table-id $PRIVATE_RT_ID \
  --destination-cidr-block 0.0.0.0/0 \
  --nat-gateway-id $NAT_GATEWAY_ID \
  --region $REGION

echo "   ✅ Route table updated: $PRIVATE_RT_ID"
echo ""

# Create/update public route table
PUBLIC_RT=$(aws ec2 create-route-table --vpc-id $VPC_ID --region $REGION --output json)
PUBLIC_RT_ID=$(echo $PUBLIC_RT | jq -r '.RouteTable.RouteTableId')

aws ec2 create-route \
  --route-table-id $PUBLIC_RT_ID \
  --destination-cidr-block 0.0.0.0/0 \
  --gateway-id $IGW_ID \
  --region $REGION

aws ec2 associate-route-table \
  --route-table-id $PUBLIC_RT_ID \
  --subnet-id $PUBLIC_SUBNET_ID \
  --region $REGION

echo "   ✅ Public route table configured: $PUBLIC_RT_ID"
echo ""

echo "═══════════════════════════════════════════════════════════════"
echo "✅ NAT GATEWAY SETUP COMPLETE"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "📌 STATIC IP ADDRESS TO WHITELIST:"
echo "   $NAT_GATEWAY_IP"
echo ""
echo "🔧 Resources Created:"
echo "   • NAT Gateway ID: $NAT_GATEWAY_ID"
echo "   • Elastic IP: $NAT_GATEWAY_IP (Allocation: $ALLOCATION_ID)"
echo "   • Public Subnet: $PUBLIC_SUBNET_ID"
echo "   • Internet Gateway: $IGW_ID"
echo "   • Public Route Table: $PUBLIC_RT_ID"
echo ""
echo "📋 Next Steps:"
echo "   1. Whitelist $NAT_GATEWAY_IP on Bright Data dashboard"
echo "   2. All traffic from EC2 instances will now use this single IP"
echo "   3. Test the campaign to verify connectivity"
echo ""
echo "💰 Cost Estimate:"
echo "   • NAT Gateway: ~\$0.045/hour + \$0.045/GB processed"
echo "   • Elastic IP: Free while in use"
echo "   • Monthly estimate: ~\$32-50 depending on traffic"
echo ""
echo "═══════════════════════════════════════════════════════════════"

# Save to file for reference
cat > nat-gateway-info.txt <<EOF
NAT Gateway Setup Complete
==========================

Static IP to whitelist: $NAT_GATEWAY_IP

Resources:
- NAT Gateway ID: $NAT_GATEWAY_ID
- Elastic IP Allocation: $ALLOCATION_ID
- Public Subnet: $PUBLIC_SUBNET_ID
- Internet Gateway: $IGW_ID
- VPC ID: $VPC_ID

Created: $(date)
EOF

echo "ℹ️  Configuration saved to: nat-gateway-info.txt"
