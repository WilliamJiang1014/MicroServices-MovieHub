#!/bin/bash
# 更新 .env 文件中的 API 密钥

sed -i.backup \
  -e 's/TMDB_API_KEY=your_tmdb_api_key_here/TMDB_API_KEY=24c39bb14fe69df0f83872167d4078f2/' \
  -e 's/OMDB_API_KEY=your_omdb_api_key_here/OMDB_API_KEY=1cfffc20/' \
  -e 's/QWEN_API_KEY=your_qwen_api_key_here/QWEN_API_KEY=sk-9bde3d29354c43f6816159e12cce0e5b/' \
  .env

echo "✅ API 密钥已更新！"
echo ""
echo "更新的密钥："
grep -E "TMDB_API_KEY|OMDB_API_KEY|QWEN_API_KEY" .env | grep -v "^#"
