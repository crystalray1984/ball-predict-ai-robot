import Decimal from 'decimal.js'
import { loadDoc } from './common'

interface OddResult {
    start: string
    end: string
}

function parseConditionPart(part: string) {
    switch (part) {
        case '平手':
            return '0'
        case '半球':
            return '0.5'
        case '一球':
            return '1'
        case '球半':
            return '1.5'
        case '两球':
            return '2'
        case '两球半':
            return '2.5'
        case '三球':
            return '3'
        case '三球半':
            return '3.5'
        case '四球':
            return '4'
        case '四球半':
            return '4.5'
        case '五球':
            return '5'
        case '五球半':
            return '5.5'
        case '六球':
            return '6'
        case '六球半':
            return '6.5'
        default:
            return ''
    }
}

function parseCondition(condition: string) {
    let symbol = '-'
    if (condition.startsWith('受让')) {
        symbol = '+'
        condition = condition.substring(2)
    }

    //拆分盘口
    const parts = condition.split('/').map(parseConditionPart)
    if (parts.length > 1) {
        //多盘口
        return Decimal(symbol + parts[0])
            .add(symbol + parts[1])
            .div(2)
            .toString()
    } else {
        //单盘口
        return Decimal(symbol + parts[0]).toString()
    }
}

function parseNumberCondition(condition: string) {
    const isNag = condition.startsWith('-')
    const parts = (isNag ? condition.substring(1) : condition).split('/')
    let result: Decimal
    if (parts.length > 1) {
        //多盘口
        result = Decimal(parts[0]).add(parts[1]).div(2)
    } else {
        //单盘口
        result = Decimal(parts[0])
    }
    if (isNag) {
        return Decimal(0).sub(result).toString()
    } else {
        return result.toString()
    }
}

/**
 * 获取全场亚让盘口
 */
async function getOdd(titan007_match_id: string): Promise<OddResult | void> {
    const $ = await loadDoc(
        `https://vip.titan007.com/changeDetail/handicap.aspx?id=${titan007_match_id}&companyid=3&l=0`,
        undefined,
        'GBK',
    )

    const list = $('span#odds2 table tr').toArray()

    //转换为数据
    let rows = list.map((tr) => {
        const cells = $(tr).find('td')
        return {
            status: cells.last().text().trim(),
            condition: $(tr)
                .find('td')
                .eq(cells.length - 4)
                .text()
                .trim(),
        }
    })

    //过滤数据
    rows = rows.filter((t) => t.status === '早' || t.status === '即')
    if (rows.length === 0) return

    //转换盘口
    const end = parseCondition(rows[0].condition)
    const start = parseCondition(rows[rows.length - 1].condition)
    return { start, end }
}

/**
 * 获取半场亚让盘口
 */
async function getPeriod1Odd(titan007_match_id: string): Promise<OddResult | void> {
    const $ = await loadDoc(
        `https://vip.titan007.com/changeDetail/handicapHalf.aspx?id=${titan007_match_id}&companyid=3&l=0`,
        undefined,
        'GBK',
    )

    const list = $('span#odds2 table tr').toArray()

    //转换为数据
    let rows = list.map((tr) => {
        const cells = $(tr).find('td')
        return {
            status: cells.last().text().trim(),
            condition: $(tr)
                .find('td')
                .eq(cells.length - 4)
                .text()
                .trim(),
        }
    })

    //过滤数据
    rows = rows.filter((t) => t.status === '早' || t.status === '即')
    if (rows.length === 0) return

    //转换盘口
    const end = parseCondition(rows[0].condition)
    const start = parseCondition(rows[rows.length - 1].condition)
    return { start, end }
}

/**
 * 获取全场大小球盘口
 */
async function getGoalOdd(titan007_match_id: string): Promise<OddResult | void> {
    const $ = await loadDoc(
        `https://vip.titan007.com/changeDetail/overunder.aspx?id=${titan007_match_id}&companyid=3&l=0`,
        undefined,
        'GBK',
    )

    const list = $('span#odds2 table tr').toArray()

    //转换为数据
    let rows = list.map((tr) => {
        const cells = $(tr).find('td')
        return {
            status: cells.last().text().trim(),
            condition: $(tr)
                .find('td')
                .eq(cells.length - 4)
                .text()
                .trim(),
        }
    })

    //过滤数据
    rows = rows.filter((t) => t.status === '早' || t.status === '即')
    if (rows.length === 0) return

    //转换盘口
    const end = parseNumberCondition(rows[0].condition)
    const start = parseNumberCondition(rows[rows.length - 1].condition)
    return { start, end }
}

/**
 * 获取半场大小球盘口
 */
async function getPeriod1GoalOdd(titan007_match_id: string): Promise<OddResult | void> {
    const $ = await loadDoc(
        `https://vip.titan007.com/changeDetail/overunderHalf.aspx?id=${titan007_match_id}&companyid=3&l=0`,
        undefined,
        'GBK',
    )

    const list = $('span#odds2 table tr').toArray()

    //转换为数据
    let rows = list.map((tr) => {
        const cells = $(tr).find('td')
        return {
            status: cells.last().text().trim(),
            condition: $(tr)
                .find('td')
                .eq(cells.length - 4)
                .text()
                .trim(),
        }
    })

    //过滤数据
    rows = rows.filter((t) => t.status === '早' || t.status === '即')
    if (rows.length === 0) return

    //转换盘口
    const end = parseNumberCondition(rows[0].condition)
    const start = parseNumberCondition(rows[rows.length - 1].condition)
    return { start, end }
}

/**
 * 获取全场角球盘口
 */
async function getCornerOdd(titan007_match_id: string): Promise<{
    ah?: OddResult
    goal?: OddResult
} | void> {
    const $ = await loadDoc(
        `https://vip.titan007.com/changeDetail/corner.aspx?id=${titan007_match_id}&companyid=3&l=0`,
        undefined,
        'GBK',
    )

    const ah_list = $('div#out table[align=center] tr td[width=60%] table tr').toArray()
    const goal_list = $('div#out table[align=center] tr td[width=40%] table tr').toArray()

    //转换为数据
    let ah_rows = ah_list.map((tr) => {
        const cells = $(tr).find('td')
        return {
            status: cells.last().text().trim(),
            condition: $(tr)
                .find('td')
                .eq(cells.length - 4)
                .text()
                .trim(),
        }
    })
    ah_rows = ah_rows.filter((t) => t.status === '早' || t.status === '即')

    let goal_rows = goal_list.map((tr) => {
        const cells = $(tr).find('td')
        return {
            status: cells.last().text().trim(),
            condition: $(tr)
                .find('td')
                .eq(cells.length - 4)
                .text()
                .trim(),
        }
    })
    goal_rows = goal_rows.filter((t) => t.status === '早' || t.status === '即')

    const ah =
        ah_rows.length > 0
            ? {
                  end: parseNumberCondition(ah_rows[0].condition),
                  start: parseNumberCondition(ah_rows[ah_rows.length - 1].condition),
              }
            : undefined
    const goal =
        goal_rows.length > 0
            ? {
                  end: parseNumberCondition(goal_rows[0].condition),
                  start: parseNumberCondition(goal_rows[goal_rows.length - 1].condition),
              }
            : undefined

    if (!ah && !goal) return
    return {
        ah,
        goal,
    }
}

/**
 * 获取球探网盘口
 */
export async function getMatchOdd(titan007_match_id: string) {
    //是否主客队交换
    const swap = titan007_match_id.startsWith('-')
    if (swap) {
        titan007_match_id = titan007_match_id.substring(1)
    }

    const ah = await getOdd(titan007_match_id)
    const goal = await getGoalOdd(titan007_match_id)
    const ah_period1 = await getPeriod1Odd(titan007_match_id)
    const goal_period1 = await getPeriod1GoalOdd(titan007_match_id)
    const corner = await getCornerOdd(titan007_match_id)

    if (swap) {
        //交换主客队
        if (ah) {
            ah.start = Decimal(0).sub(ah.start).toString()
            ah.end = Decimal(0).sub(ah.end).toString()
        }
        if (ah_period1) {
            ah_period1.start = Decimal(0).sub(ah_period1.start).toString()
            ah_period1.end = Decimal(0).sub(ah_period1.end).toString()
        }
        if (corner && corner.ah) {
            corner.ah.start = Decimal(0).sub(corner.ah.start).toString()
            corner.ah.end = Decimal(0).sub(corner.ah.end).toString()
        }
    }

    return {
        ah,
        goal,
        ah_period1,
        goal_period1,
        corner,
    }
}

if (require.main === module) {
    getMatchOdd('2607224').finally(() => process.exit())
}
