import { describe, expect, it } from 'vitest'
import { convertInchesToTwip } from 'docx'
import { EMPTY_PDF_TEXT_ERROR, joinLineItems, throwIfNoText, tightenCjkSpacing, pdfPointsToTwips, pdfPointsToWordPixels, pdfPointsToEmu, groupLaidOutItems, detectHeaderBottom, markSectionHeadings, filterOutlierItems, normalizePageLines, linesToDocBlocks, packPagesToWord, pdfToWord } from './pdf-to-word'
import mammoth from 'mammoth'
import { makePdf } from './test-pdf'

describe('tightenCjkSpacing', () => {
  it('removes spaces between CJK characters', () => {
    expect(tightenCjkSpacing('关于 规范 费用 报销')).toBe('关于规范费用报销')
  })
})

describe('joinLineItems', () => {
  it('does not insert spaces between CJK runs', () => {
    expect(joinLineItems(['发票', '金额'])).toBe('发票金额')
  })

  it('keeps spaces between latin words', () => {
    expect(joinLineItems(['Hello', 'World'])).toBe('Hello World')
  })
})

describe('throwIfNoText', () => {
  it('throws for empty conversion results', () => {
    expect(() => throwIfNoText(0)).toThrow(EMPTY_PDF_TEXT_ERROR)
  })

  it('allows non-empty conversion results', () => {
    expect(() => throwIfNoText(3)).not.toThrow()
  })
})

describe('page size helpers', () => {
  it('converts A4 PDF points to Word twips and pixels', () => {
    expect(pdfPointsToTwips(595.28)).toBe(convertInchesToTwip(595.28 / 72))
    expect(pdfPointsToWordPixels(72)).toBe(96)
    expect(pdfPointsToEmu(72)).toBe(914400)
  })
})

describe('groupLaidOutItems', () => {
  it('joins items on the same visual line', () => {
    const lines = groupLaidOutItems([
      { text: '关于', x: 100, y: 80, width: 40, height: 16 },
      { text: '规范', x: 142, y: 81, width: 40, height: 16 },
      { text: '各部门', x: 72, y: 140, width: 60, height: 14 },
    ])
    expect(lines.map((line) => line.text)).toEqual(['关于规范', '各部门'])
  })
})

describe('detectHeaderBottom', () => {
  it('uses the gap after letterhead', () => {
    const bottom = detectHeaderBottom(
      [
        { text: '上海科洋', x: 40, y: 28, width: 200, height: 16, fontSize: 16 },
        { text: '地址', x: 360, y: 30, width: 120, height: 10, fontSize: 10 },
        { text: '关于规范费用报销', x: 150, y: 120, width: 280, height: 18, fontSize: 18 },
      ],
      842
    )
    expect(bottom).toBeGreaterThan(40)
    expect(bottom).toBeLessThan(120)
  })
})

describe('markSectionHeadings', () => {
  it('marks Chinese section titles as bold', () => {
    const lines = markSectionHeadings([
      { text: '一、不予报销的费用项目', x: 72, y: 200, width: 200, height: 14, fontSize: 14 },
      { text: '下列支出', x: 72, y: 230, width: 80, height: 12, fontSize: 12 },
    ])
    expect(lines[0].bold).toBe(true)
  })
})

describe('filterOutlierItems', () => {
  it('drops a tall merged block that is not a real word', () => {
    const kept = filterOutlierItems([
      { text: '个人', x: 80, y: 300, width: 28, height: 14 },
      { text: '消费', x: 110, y: 300, width: 28, height: 14 },
      { text: '3，个人消费类支出...整段', x: 40, y: 280, width: 500, height: 120 },
    ])
    expect(kept.map((item) => item.text)).toEqual(['个人', '消费'])
  })
})

describe('normalizePageLines', () => {
  it('clamps a giant overlay line and keeps normal body text', () => {
    const lines = normalizePageLines(
      [
        { text: '各部门、全体员工：', x: 72, y: 180, width: 160, height: 14, fontSize: 14 },
        { text: '3，个人消费类支出整段叠字', x: 20, y: 320, width: 540, height: 160, fontSize: 140 },
        { text: '备注：确因公务接待', x: 72, y: 500, width: 200, height: 13, fontSize: 13 },
      ],
      595
    )
    expect(lines.some((line) => line.fontSize > 20)).toBe(false)
    expect(lines.some((line) => line.height > 30)).toBe(false)
    expect(lines.map((line) => line.text)).toContain('各部门、全体员工：')
  })
})

describe('linesToDocBlocks', () => {
  it('merges wrapped lines and keeps title, heading, list as few blocks', () => {
    const blocks = linesToDocBlocks(
      [
        { text: '关于规范费用报销及个人所得税相关事项的通知', x: 140, y: 80, width: 320, height: 18, fontSize: 16 },
        { text: '各部门、全体员工：', x: 72, y: 130, width: 160, height: 14, fontSize: 12 },
        { text: '为进一步规范公司费用报销管理，', x: 96, y: 160, width: 280, height: 14, fontSize: 12 },
        { text: '现将有关事项通知如下：', x: 72, y: 176, width: 200, height: 14, fontSize: 12 },
        { text: '一、不予报销的费用项目', x: 72, y: 210, width: 200, height: 14, fontSize: 13 },
        { text: '1. 预充值及储值类支出：各类预充值卡、', x: 86, y: 240, width: 260, height: 14, fontSize: 12 },
        { text: '购物卡、礼品卡。', x: 100, y: 256, width: 140, height: 14, fontSize: 12 },
        { text: '2. 休闲娱乐类支出：景点门票。', x: 86, y: 280, width: 220, height: 14, fontSize: 12 },
      ],
      595
    )
    expect(blocks.map((block) => block.kind)).toEqual([
      'title',
      'greeting',
      'paragraph',
      'heading',
      'list',
      'list',
    ])
    expect(blocks[0].text).toContain('关于规范费用报销')
    expect(blocks.find((block) => block.kind === 'list' && block.text.startsWith('1.'))?.text).toContain('购物卡')
  })
})

describe('packPagesToWord', () => {
  it('writes editable paragraph text instead of per-line frames', async () => {
    const buffer = await packPagesToWord([
      {
        widthPt: 595,
        heightPt: 842,
        lines: [
          { text: '关于规范费用报销及个人所得税相关事项的通知', x: 140, y: 80, width: 320, height: 18, fontSize: 16 },
          { text: '各部门、全体员工：', x: 72, y: 130, width: 160, height: 14, fontSize: 12 },
          { text: '一、不予报销的费用项目', x: 72, y: 200, width: 200, height: 14, fontSize: 13 },
        ],
      },
    ])
    const html = (await mammoth.convertToHtml({ buffer: Buffer.from(buffer) })).value
    expect(html).toContain('关于规范费用报销')
    expect(html).toContain('全体员工')
    expect(html).toContain('不予报销')
  })

  it('throws when no text was recognized', async () => {
    await expect(packPagesToWord([{ widthPt: 595, heightPt: 842, lines: [] }])).rejects.toThrow(
      EMPTY_PDF_TEXT_ERROR
    )
  })
})

describe('pdfToWord', () => {
  it('requires the desktop window for page rendering', async () => {
    await expect(pdfToWord(await makePdf('Scan'))).rejects.toThrow('应用窗口')
  })
})
