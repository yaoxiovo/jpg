const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const rawDir = path.join(__dirname, 'astro', 'raw');
const webpDir = path.join(__dirname, 'astro', 'webp');

// 递归遍历文件夹
async function walkDir(currentDir, relativePath = '') {
  const absoluteCurrentDir = path.join(currentDir, relativePath);
  const files = fs.readdirSync(absoluteCurrentDir);

  for (const file of files) {
    const fileRelativePath = path.join(relativePath, file);
    const absolutePath = path.join(currentDir, fileRelativePath);
    const stat = fs.statSync(absolutePath);

    if (stat.isDirectory()) {
      // 递归子目录
      await walkDir(currentDir, fileRelativePath);
    } else {
      // 检查是否是图片文件
      const ext = path.extname(file).toLowerCase();
      if (['.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.webp'].includes(ext)) {
        await processImage(fileRelativePath);
      }
    }
  }
}

// 处理单张图片，生成对应的 webp 缩略图
async function processImage(fileRelativePath) {
  const sourcePath = path.join(rawDir, fileRelativePath);
  
  // 计算输出的 webp 路径，保持原本的子目录结构
  const relativeWebpPath = fileRelativePath.replace(/\.[^.]+$/, '.webp');
  const targetPath = path.join(webpDir, relativeWebpPath);
  
  // 确保目标子目录存在
  const targetSubdir = path.dirname(targetPath);
  if (!fs.existsSync(targetSubdir)) {
    fs.mkdirSync(targetSubdir, { recursive: true });
  }

  // 增量生成：如果缩略图已经存在且原图修改时间没有更新，我们就跳过
  if (fs.existsSync(targetPath)) {
    const sourceStat = fs.statSync(sourcePath);
    const targetStat = fs.statSync(targetPath);
    if (sourceStat.mtimeMs <= targetStat.mtimeMs) {
      console.log(`[Skip] ${fileRelativePath} is up-to-date.`);
      return;
    }
  }

  try {
    console.log(`[Process] Generating thumbnail for ${fileRelativePath}...`);
    
    // 读取图片信息以进行等比缩放
    const image = sharp(sourcePath);
    const metadata = await image.metadata();
    
    let pipeline = image;
    // 如果宽度大于 800px，等比缩放到 800px 宽度
    if (metadata.width && metadata.width > 800) {
      pipeline = pipeline.resize(800);
    }
    
    // 转换为 webp，设置质量为 80，以达到极佳的压缩比和画质平衡
    await pipeline
      .webp({ quality: 80 })
      .toFile(targetPath);
      
    console.log(`[Success] Thumbnail saved to webp/${relativeWebpPath}`);
  } catch (err) {
    console.error(`[Error] Failed to process ${fileRelativePath}:`, err);
  }
}

// 启动处理
if (fs.existsSync(rawDir)) {
  console.log('Starting thumbnail generation...');
  walkDir(rawDir).then(() => {
    console.log('Thumbnail generation completed!');
  });
} else {
  console.error(`Raw directory not found at: ${rawDir}`);
}
