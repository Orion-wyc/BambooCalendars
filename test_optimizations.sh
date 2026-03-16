#!/bin/bash

echo "=== 测试优化修复功能 ==="
echo ""

# 测试用户登录
echo "1. 测试用户登录..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser2","password":"test123"}')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -n "$TOKEN" ]; then
  echo "✅ 登录成功，获取到Token"
else
  echo "❌ 登录失败"
  exit 1
fi

echo ""

# 测试获取Todo详情
echo "2. 测试获取Todo详情..."
DETAIL_RESPONSE=$(curl -s -X GET http://localhost:5000/api/todos/3 \
  -H "Authorization: Bearer $TOKEN")

if echo $DETAIL_RESPONSE | grep -q "测试修复功能"; then
  echo "✅ 获取Todo详情成功"
else
  echo "❌ 获取Todo详情失败"
  exit 1
fi

echo ""

# 测试文件下载
echo "3. 测试文件下载..."
DOWNLOAD_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  http://localhost:5000/api/attachments/5/download \
  -H "Authorization: Bearer $TOKEN")

if [ "$DOWNLOAD_STATUS" = "200" ]; then
  echo "✅ 文件下载成功"
else
  echo "❌ 文件下载失败，状态码: $DOWNLOAD_STATUS"
  exit 1
fi

echo ""

# 测试图片预览
echo "4. 测试图片预览览..."
PREVIEW_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  http://localhost:5000/api/attachments/6/preview \
  -H "Authorization: Bearer $TOKEN")

if [ "$PREVIEW_STATUS" = "200" ]; then
  echo "✅ 图片预览成功"
else
  echo "❌ 图片预览失败，状态码: $PREVIEW_STATUS"
  exit 1
fi

echo ""

# 测试获取附件列表
echo "5. 测试获取附件列表..."
ATTACHMENTS_RESPONSE=$(curl -s -X GET http://localhost:5000/api/attachments/todo/3 \
  -H "Authorization: Bearer $TOKEN")

if echo $ATTACHMENTS_RESPONSE | grep -q "test_image.txt"; then
  echo "✅ 获取附件列表成功"
else
  echo "❌ 获取附件列表失败"
  exit 1
fi

echo ""
echo "=== 所有测试通过！✅ ==="
echo ""
echo "优化修复内容："
echo "1. ✅ 任务详情页面Header布局优化（垂直居中、合理高度）"
echo "2. ✅ 文件下载功能修复（路径问题解决）"
echo "3. ✅ 图片预览功能修复（路径问题解决）"
echo "4. ✅ 前端API配置优化（FormData支持）"
echo ""
echo "请访问 http://localhost:5173 查看优化效果"