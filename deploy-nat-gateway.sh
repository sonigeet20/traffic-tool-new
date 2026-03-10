#!/bin/bash

# AWS NAT Gateway Setup for Single IP Whitelisting
# Instance: i-01b53f76120d7a1f3
# VPC: vpc-0526c9da5a05585c5
# Current Subnet: subnet-05a445f4f9f839e5c (private)
# Region: us-east-1

set -e

INSTANCE_ID="i-01b53f76120d7a1f3"
VPC_ID="vpc-0526c9da5a05585c5"
PRIVATE_SUBNET_ID="subnet-05a445f4f9f839e5c"
REGION="us-east-1"
AZ="us-east-1b"

echo "🌐 AWS NAT Gateway Setup for Bright Data IP Whitelisting"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "📋 Infrastructure:"
echo "   Instance ID: $INSTANCE_ID"
echo "   VPC ID: $VPC_ID"
echo "   Private Subnet: $PRIVATE_SUBNET_ID"
echo "   Availability Zone: $AZ"
echo ""

# Step 1: Allocate Elastic IP
echo "1️⃣  Allocating Elastic IP for NAT Gateway..."
EIP_OUTPUT=$(aws ec2 allocate-address \
  --domain vpc \
  --region $REGION \
  --tag-specifications 'ResourceType=elastic-ip,Tags=[{Key=Name,Value=NAT-Gateway-EIP},{Key=Purpose,Value=BrightData-Whitelist}]' \
  --output json)

ALLOCATION_ID=$(echo $EIP_OUTPUT | jq -r '.AllocationId')
STATIC_IP=$(echo $EIP_OUTPUT | jq -r '.PublicIp')

echo "   ✅ Elastic IP: $STATIC_IP"
echo "   📌 Allocation ID: $ALLOCATION_ID"
echo ""

# Step 2: Create public subnet for NAT Gateway
echo "2️⃣  Creating public subnet for NAT Gateway..."

# Get VPC CIDR
VPC_CIDR=$(aws ec2 describe-vpcs --vpc-ids $VPC_ID --query 'Vpcs[0].CidrBlock' --output text --region $REGION)
echo "   VPC CIDR: $VPC_CIDR"

# Create public subnet (using VPC's CIDR range - 172.31.112.0/24 avoids existing subnets)
PUBLIC_SUBNET_OUTPUT=$(aws ec2 create-subnet \
  --vpc-id $VPC_ID \
  --cidr-block 172.31.112.0/24 \
  --availability-zone $AZ \
  --region $REGION \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=NAT-Gateway-Public-Subnet}]' \
  --output json)

PUBLIC_SUBNET_ID=$(echo $PUBLIC_SUBNET_OUTPUT | jq -r '.Subnet.SubnetId')
echo "   ✅ Public Subnet: $PUBLIC_SUBNET_ID (172.31.112.0/24)"
echo ""

# Step 3: Create or get Internet Gateway
echo "3️⃣  Setting up Internet Gateway..."
IGW_ID=$(aws ec2 describe-internet-gateways \
  --filters "Name=attachment.vpc-id,Values=$VPC_ID" \
  --query 'InternetGateways[0].InternetGatewayId' \
  --output text \
  --region $REGION)

if [ "$IGW_ID" == "None" ] || [ -z "$IGW_ID" ]; then
  echo "   Creating new Internet Gateway..."
  IGW_OUTPUT=$(aws ec2 create-internet-gateway \
    --tag-specifications 'ResourceType=internet-gateway,Tags=[{Key=Name,Value=NAT-IGW}]' \
    --region $REGION \
    --output json)
  
  IGW_ID=$(echo $IGW_OUTPUT | jq -r '.InternetGateway.InternetGatewayId')
  
  aws ec2 attach-internet-gateway \
    --vpc-id $VPC_ID \
    --internet-gateway-id $IGW_ID \
    --region $REGION
  
  echo "   ✅ Internet Gateway created and attached: $IGW_ID"
else
  echo "   ✅ Using existing Internet Gateway: $IGW_ID"
fi
echo ""

# Step 4: Create public route table
echo "4️⃣  Creating public route table..."
PUBLIC_RT_OUTPUT=$(aws ec2 create-route-table \
  --vpc-id $VPC_ID \
  --tag-specifications 'ResourceType=route-table,Tags=[{Key=Name,Value=NAT-Public-RT}]' \
  --region $REGION \
  --output json)

PUBLIC_RT_ID=$(echo $PUBLIC_RT_OUTPUT | jq -r '.RouteTable.RouteTableId')

# Add internet route
aws ec2 create-route \
  --route-table-id $PUBLIC_RT_ID \
  --destination-cidr-block 0.0.0.0/0 \
  --gateway-id $IGW_ID \
  --region $REGION > /dev/null

# Associate with public subnet
aws ec2 associate-route-table \
  --route-table-id $PUBLIC_RT_ID \
  --subnet-id $PUBLIC_SUBNET_ID \
  --region $REGION > /dev/null

echo "   ✅ Public Route Table: $PUBLIC_RT_ID"
echo ""

# Step 5: Create NAT Gateway
echo "5️⃣  Creating NAT Gateway..."
echo "   ⏳ This takes 2-5 minutes..."

NAT_OUTPUT=$(aws ec2 create-nat-gateway \
  --subnet-id $PUBLIC_SUBNET_ID \
  --allocation-id $ALLOCATION_ID \
  --tag-specifications 'ResourceType=natgateway,Tags=[{Key=Name,Value=BrightData-NAT},{Key=Purpose,Value=IP-Whitelisting}]' \
  --region $REGION \
  --output json)

NAT_GATEWAY_ID=$(echo $NAT_OUTPUT | jq -r '.NatGateway.NatGatewayId')
echo "   📌 NAT Gateway ID: $NAT_GATEWAY_ID"

# Wait for NAT Gateway
aws ec2 wait nat-gateway-available \
  --nat-gateway-ids $NAT_GATEWAY_ID \
  --region $REGION

echo "   ✅ NAT Gateway is available!"
echo ""

# Step 6: Update private subnet route table
echo "6️⃣  Updating private subnet route table..."

PRIVATE_RT_ID=$(aws ec2 describe-route-tables \
  --filters "Name=association.subnet-id,Values=$PRIVATE_SUBNET_ID" \
  --query 'RouteTables[0].RouteTableId' \
  --region $REGION \
  --output text)

# Delete existing default route if exists
aws ec2 delete-route \
  --route-table-id $PRIVATE_RT_ID \
  --destination-cidr-block 0.0.0.0/0 \
  --region $REGION 2>/dev/null || true

# Add new route through NAT Gateway
aws ec2 create-route \
  --route-table-id $PRIVATE_RT_ID \
  --destination-cidr-block 0.0.0.0/0 \
  --nat-gateway-id $NAT_GATEWAY_ID \
  --region $REGION > /dev/null

echo "   ✅ Private Route Table updated: $PRIVATE_RT_ID"
echo "   ✅ All outbound traffic now routes through NAT Gateway"
echo ""

# Verify the setup
echo "7️⃣  Verifying NAT Gateway configuration..."
NAT_STATUS=$(aws ec2 describe-nat-gateways \
  --nat-gateway-ids $NAT_GATEWAY_ID \
  --query 'NatGateways[0].State' \
  --output text \
  --region $REGION)

echo "   NAT Gateway Status: $NAT_STATUS"
echo ""

echo "════════════════════════════════════════════════════════════"
echo "✅ NAT GATEWAY SETUP COMPLETE!"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "🎯 STATIC IP ADDRESS TO WHITELIST ON BRIGHT DATA:"
echo ""
echo "   $STATIC_IP"
echo ""
echo "════════════════════════════════════════════════════════════"
echo ""
echo "📦 Resources Created:"
echo "   • NAT Gateway: $NAT_GATEWAY_ID"
echo "   • Elastic IP: $STATIC_IP"
echo "   • Allocation ID: $ALLOCATION_ID"
echo "   • Public Subnet: $PUBLIC_SUBNET_ID"
echo "   • Internet Gateway: $IGW_ID"
echo "   • Public Route Table: $PUBLIC_RT_ID"
echo "   • Private Route Table: $PRIVATE_RT_ID (updated)"
echo ""
echo "🔧 What Changed:"
echo "   • Created public subnet with NAT Gateway"
echo "   • All EC2 outbound traffic now uses NAT Gateway"
echo "   • Single static IP: $STATIC_IP"
echo ""
echo "📋 Next Steps:"
echo "   1. Whitelist $STATIC_IP in Bright Data dashboard"
echo "   2. Test campaign to verify connectivity"
echo "   3. All traffic will now originate from this single IP"
echo ""
echo "💰 Monthly Cost Estimate:"
echo "   • NAT Gateway: ~\$32.40 (720 hrs × \$0.045)"
echo "   • Data Transfer: ~\$0.045/GB"
echo "   • Elastic IP: Free (while attached)"
echo "   • Total: ~\$35-60/month depending on traffic"
echo ""
echo "🗑️  To Delete (if needed):"
echo "   aws ec2 delete-nat-gateway --nat-gateway-id $NAT_GATEWAY_ID --region $REGION"
echo "   aws ec2 release-address --allocation-id $ALLOCATION_ID --region $REGION"
echo ""

# Save configuration
cat > nat-gateway-config.txt <<EOF
NAT Gateway Configuration
=========================

WHITELIST THIS IP ON BRIGHT DATA:
$STATIC_IP

Resources:
----------
NAT Gateway ID: $NAT_GATEWAY_ID
Elastic IP: $STATIC_IP
Allocation ID: $ALLOCATION_ID
Public Subnet: $PUBLIC_SUBNET_ID
Internet Gateway: $IGW_ID
Public Route Table: $PUBLIC_RT_ID
Private Route Table: $PRIVATE_RT_ID

VPC: $VPC_ID
Region: $REGION

Created: $(date)
Status: Active

Delete Commands:
----------------
aws ec2 delete-nat-gateway --nat-gateway-id $NAT_GATEWAY_ID --region $REGION
aws ec2 wait nat-gateway-deleted --nat-gateway-ids $NAT_GATEWAY_ID --region $REGION
aws ec2 release-address --allocation-id $ALLOCATION_ID --region $REGION
aws ec2 delete-subnet --subnet-id $PUBLIC_SUBNET_ID --region $REGION
aws ec2 delete-route-table --route-table-id $PUBLIC_RT_ID --region $REGION
EOF

echo "💾 Configuration saved to: nat-gateway-config.txt"
echo ""
echo "════════════════════════════════════════════════════════════"
