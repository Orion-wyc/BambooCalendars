#!/bin/bash

echo "=== 测试修复功能 ==="
echo ""

# 测试用户登录
echo "1. 测试用户登录..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"test123"}')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -n "$TOKEN" ]; then
  echo "✅ 登录成功，获取到Token"
else
  echo "❌ 登录失败"
  exit 1
fi

echo ""

# 测试创建Todo
echo "2. 测试创建Todo..."
TODO_RESPONSE=$(curl -s -X POST http://localhost:5000/api/todos \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"title":"测试修复功能","description":"测试布局和上传功能","priority":"high"}')

TODO_ID=$(echo $TODO_RESPONSE | grep -o '"id":[0-9]*' | cut -d':' -f2 | head -1)

if [ -n "$TODO_ID" ]; then
  echo "✅ 创建Todo成功，ID: $TODO_ID"
else
  echo "❌ 创建Todo失败"
  exit 1
fi

echo ""

# 测试获取Todo详情
echo "3. 测试获取Todo详情..."
DETAIL_RESPONSE=$(curl -s -X GET http://localhost:5000/api/todos/$TODO_ID \
  -H "Authorization: Bearer $TOKEN")

if echo $DETAIL_RESPONSE | grep -q "测试修复功能"; then
  echo "✅ 获取Todo详情成功"
else
  echo "❌ 获取Todo详情失败"
  exit 1
fi

echo ""

# 测试文件上传
echo "4. 测试文件上传..."
echo "测试文件内容" > /tmp/test_upload.txt
UPLOAD_RESPONSE=$(curl -s -X POST http://localhost:5000/api/attachments/todo/$TODO_ID \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/tmp/test_upload.txt")

if echo $UPLOAD_RESPONSE | grep -q "success.*true"; then
  echo "✅ 文件上传成功"
else
  echo "❌ 文件上传失败"
  echo $UPLOAD_RESPONSE
  exit 1
fi

echo ""

# 测试获取附件列表
echo "5. 测试获取附件列表..."
ATTACHMENTS_RESPONSE=$(curl -s -X GET http://localhost:5000/api/attachments/todo/$TODO_ID \
  -H "Authorization: Bearer $TOKEN")

if echo $ATTACHMENTS_RESPONSE | grep -q "test_upload.txt"; then
  echo "✅ 获取附件列表成功"
else
  echo "❌ 获取附件列表失败"
  echo $ATTACHMENTS_RESPONSE
  exit 1
fi

echo ""

# 测试标记完成
echo "6. 测试标记完成..."
COMPLETE_RESPONSE=$(curl -s -X PATCH http://localhost:5000/api/todos/$TODO_ID/complete \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"is_completed":true}')

if echo $COMPLETE_RESPONSE | grep -q "is_completed.*true"; then
  echo "✅ 标记完成成功"
else
  echo "❌ 标记完成失败"
  echo $COMPLETE_RESPONSE
  exit 1
fi

echo ""

# 测试获取Todo列表（验证状态更新）
echo "7. 测试获取Todo列表（验证状态更新）..."
TODOS_RESPONSE=$(curl -s -X GET http://localhost:5000/api/todos \
  -H "Authorization: Bearer $TOKEN")

if echo $TODOS_RESPONSE | grep -q "is_completed.*true"; then
  echo "✅ 状态更新成功"
else
  echo "❌ 状态更新失败"
  echo $TODOS_RESPONSE
  exit 1
fi

echo ""
echo "=== 所有测试通过！✅ ==="
echo ""
echo "修复内容："
echo "1. ✅ 任务详情页面Header布局优化"
echo "2. ✅ 主页标记完成不进入详情页"
echo "3. ✅ 任务详情页附件上传功能修复"
echo ""
echo "请访问 http://localhost:5173 查看修复效果"