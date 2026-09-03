# 发票合并到A4纸功能实现计划

## 1. 功能概述
将多个单页PDF发票排列到一张A4纸上，支持多种布局和旋转选项，方便打印。

## 2. 技术实现

### 2.1 创建PDF处理库 `src/lib/pdf-n-up.ts`
```typescript
// 核心功能：
// 1. 加载多个PDF文件
// 2. 根据选择的布局计算排列方式
// 3. 自动计算间距和边距
// 4. 支持手动旋转选项
// 5. 生成新的A4 PDF文件

// 关键函数：
// - calculateLayout(layout: LayoutOptions): LayoutResult
// - createNUpPdf(files: PdfFile[], options: NUpOptions): Promise<ArrayBuffer>
// - rotatePage(page: PDFPage, rotation: number): void
```

### 2.2 创建页面组件 `src/pages/NUp.tsx`
功能模块：
- **文件上传区域**：复用现有的 `FileUploader` 组件
- **文件列表**：复用 `FileList` 组件，显示已上传的PDF
- **布局设置面板**：
  - 预设布局选择（2x2、3x2）
  - 自定义布局（行数、列数）
  - 边距设置
- **旋转控制**：
  - 每张发票单独显示旋转按钮
  - 支持0°、90°、180°、270°旋转
- **预览区域**（可选）：显示A4纸的排列预览
- **处理按钮**：开始生成合并后的PDF

### 2.3 更新路由和导航
- `src/App.tsx`：添加路由 `/n-up`
- `src/pages/Dashboard.tsx`：添加新工具入口

## 3. 具体实现步骤

### 步骤1：创建PDF处理库
1. 创建 `src/lib/pdf-n-up.ts`
2. 实现布局计算函数
3. 实现PDF页面排列和旋转功能
4. 实现自动间距优化算法

### 步骤2：创建页面组件
1. 创建 `src/pages/NUp.tsx`
2. 实现文件上传和管理
3. 实现布局选择界面
4. 实现旋转控制界面
5. 实现处理流程

### 步骤3：集成到应用
1. 更新路由配置
2. 更新仪表板入口
3. 添加必要的类型定义

## 4. 关键技术点

### 4.1 PDF处理（使用pdf-lib）
```typescript
// 加载PDF
const pdfDoc = await PDFDocument.load(buffer)

// 获取页面尺寸
const page = pdfDoc.getPage(0)
const { width, height } = page.getSize()

// 旋转页面
page.setRotation(degrees(rotation))

// 缩放和移动页面到目标位置
page.scale(scaleFactor)
page.translate(x, y)
```

### 4.2 A4纸尺寸
- 标准A4尺寸：210mm × 297mm
- 像素尺寸（72 DPI）：595.28 × 841.89 points
- 需要预留边距（如10mm）

### 4.3 布局计算
```typescript
// 2x2布局示例
const cols = 2
const rows = 2
const cellWidth = (a4Width - margins) / cols
const cellHeight = (a4Height - margins) / rows

// 自动优化间距
const optimalSpacing = calculateOptimalSpacing(pages, cellWidth, cellHeight)
```

## 5. 用户界面设计

### 5.1 主界面布局
```
┌─────────────────────────────────────┐
│           发票合并到A4纸              │
├─────────────────────────────────────┤
│  [文件上传区域]                      │
│                                     │
│  [文件列表]                         │
│  - file1.pdf (旋转: 0°) [旋转按钮]  │
│  - file2.pdf (旋转: 90°) [旋转按钮] │
│                                     │
│  [布局设置]                         │
│  预设: [2x2] [3x2] [自定义]         │
│  行数: [___] 列数: [___]            │
│  边距: [自动优化]                    │
│                                     │
│  [预览区域] (可选)                   │
│  ┌─────┬─────┐                      │
│  │  1  │  2  │                      │
│  ├─────┼─────┤                      │
│  │  3  │  4  │                      │
│  └─────┴─────┘                      │
│                                     │
│  [开始合并]                         │
└─────────────────────────────────────┘
```

## 6. 文件结构变更

新增文件：
- `src/lib/pdf-n-up.ts` - PDF处理库
- `src/pages/NUp.tsx` - 页面组件

修改文件：
- `src/App.tsx` - 添加路由
- `src/pages/Dashboard.tsx` - 添加工具入口

## 7. 实现优先级

1. **P0（核心功能）**：
   - PDF处理库基础功能
   - 文件上传和管理
   - 基本布局（2x2、3x2）
   - 生成合并PDF

2. **P1（增强功能）**：
   - 自定义布局
   - 旋转控制
   - 自动间距优化

3. **P2（可选功能）**：
   - 预览功能
   - 保存布局预设
   - 批量处理

## 8. 测试用例

1. **基本功能测试**：
   - 上传2个PDF，使用2x2布局
   - 上传6个PDF，使用3x2布局
   - 验证生成的PDF是否正确排列

2. **旋转测试**：
   - 上传横向PDF，测试旋转功能
   - 验证旋转后的排列是否正确

3. **边界测试**：
   - 上传超过布局容量的PDF（如7个PDF用2x2布局）
   - 上传空PDF或损坏的PDF

## 9. 注意事项

1. **性能考虑**：
   - 大量PDF文件可能需要较长时间处理
   - 需要显示进度条

2. **内存管理**：
   - PDF文件可能很大，需要及时释放内存
   - 使用ArrayBuffer副本避免修改原始文件

3. **兼容性**：
   - 确保在不同操作系统上都能正常工作
   - 处理不同版本的PDF格式
