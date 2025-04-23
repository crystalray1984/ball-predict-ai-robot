import { Decimal } from 'decimal.js'
import { XMLParser } from 'fast-xml-parser'
import { URL } from 'node:url'
import puppeteer, { Page } from 'puppeteer'
import { delay } from './common/helpers'

/**
 * 皇冠首页地址
 */
const PAGE_URL = new URL('/', process.env.CROWN_URL ?? 'https://mos011.com').href

/**
 * 等待页面的元素出现
 * @param page 页面对象
 * @param selector 元素选择器
 * @returns
 */
async function waitForElement(page: Page, selector: string, cancelToken?: { aborted: boolean }) {
    while (true) {
        try {
            const element = await page.$(selector)
            if (element || cancelToken?.aborted) return
        } catch (err) {
            if (
                !(err instanceof Error) ||
                !err.message.includes('Execution context was destroyed')
            ) {
                throw err
            }
        }

        await delay(300)
    }
}

/**
 * 皇冠主页面
 */
let mainPage: Page = undefined as unknown as Page
/**
 * 页面上次初始化的时间
 */
let lastActiveTime = 0

/**
 * 初始化皇冠爬取环境
 */
export async function init() {
    if (mainPage) {
        const browser = mainPage.browser()
        await mainPage.close()
        if (browser) {
            await browser.close()
        }
        mainPage = undefined as unknown as Page
    }

    const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-images', '--lang zh-cn'],
    })

    const page = await browser.newPage()
    await page.goto(PAGE_URL)
    console.log('page navigated')

    //等待登录脚本完成
    await page.waitForSelector('#usr')
    console.log('login form ready')
    await page.locator('#usr').fill(process.env.CROWN_USERNAME!)
    await page.locator('#pwd').fill(process.env.CROWN_PASSWORD!)
    await page.locator('.check_remember.lab_radio').click()
    await page.locator('#btn_login').click()
    console.log('login form submitted')

    //等待数字密码的确认
    await waitForElement(page, '#C_popup_checkbox .lab_radio')
    await page.locator('#C_popup_checkbox .lab_radio').click()
    console.log('checkbox clicked')

    await page.locator('#C_no_btn').click()
    console.log('no_password clicked')

    await page.waitForNavigation()
    console.log(page.url())

    //等待主页加载完成
    await waitForElement(page, '#today_page')
    console.log('home page ready')

    mainPage = page
    lastActiveTime = Date.now()
}

/**
 * 等待页面准备完毕
 */
async function ready() {
    if (!mainPage || Date.now() - lastActiveTime >= 900000) {
        await init()
    }
}

/**
 * 负责解析XML数据的解析器
 */
const parser = new XMLParser({
    parseTagValue: false,
    processEntities: false,
    ignoreDeclaration: true,
})

/**
 * 读取皇冠盘口数据
 * @param crown_match_id 皇冠比赛id
 * @param show_type 数据类型
 * @returns
 */
async function _getCrownData(
    crown_match_id: string,
    show_type: 'today' | 'early' = 'today',
): Promise<Crown.Resp> {
    console.log('发起皇冠请求', crown_match_id, show_type)
    await ready()

    const func = `
(function () {
    var par = top.param;
    par += "&p=get_game_more";
    par += "&gtype=ft";
    par += "&showtype=" + ${JSON.stringify(show_type)};
    par += "&ltype=" + top["userData"].ltype;
    par += "&isRB=N";
    par += "&specialClick=";
    par += "&mode=NORMAL";
    par += "&filter=All";
    par += "&ts=" + Date.now();
    par += "&ecid=" + ${JSON.stringify(crown_match_id)};

    var params = new URLSearchParams(par);
    params.set('langx', 'zh-cn');

    var getHTML = new HttpRequest;
    return new Promise((resolve, reject) => {
        getHTML.addEventListener("onError", reject);
        getHTML.addEventListener("LoadComplete", resolve);
        getHTML.loadURL(top.m2_url, "POST", params.toString())
    })
})()
`

    const resp = (await mainPage.evaluate(func)) as string
    console.log('皇冠请求完成', crown_match_id, show_type)
    return parser.parse(resp).serverresponse
}

/**
 * 读取皇冠盘口数据
 * @param crown_match_id 皇冠比赛id
 * @param show_type 数据类型
 * @returns
 */
export async function getCrownData(
    crown_match_id: string,
    show_type: 'today' | 'early' = 'today',
): Promise<Crown.Resp> {
    let tryCount = 3
    while (true) {
        try {
            return await _getCrownData(crown_match_id, show_type)
        } catch (err) {
            console.error(err)
            console.log(err)
            console.log('重试次数', tryCount)
            tryCount--
            if (tryCount <= 0) {
                throw err
            }
            reset()
        }
    }
}

/**
 * 重置皇冠抓取环境
 */
export function reset() {
    lastActiveTime = 0
}

/**
 * 计算皇冠的赔率，从原始的亚赔数据转换为欧赔
 * @param value1 主队赔率
 * @param value2 客队赔率
 */
export function changeValue(value1: string, value2: string) {
    function chg_ior(iorH: number, iorC: number): [string, string] {
        iorH = Math.floor(iorH * 1e3 + 0.001) / 1e3
        iorC = Math.floor(iorC * 1e3 + 0.001) / 1e3
        if (iorH < 11) iorH *= 1e3
        if (iorC < 11) iorC *= 1e3
        iorH = parseFloat(iorH as unknown as string)
        iorC = parseFloat(iorC as unknown as string)
        const ior = get_EU_ior(iorH, iorC)
        ior[0] /= 1e3
        ior[1] /= 1e3
        return [printf(Decimal_point(ior[0], 100), 2), printf(Decimal_point(ior[1], 100), 2)]
    }

    function get_EU_ior(H_ratio: number, C_ratio: number): [number, number] {
        const out_ior = get_HK_ior(H_ratio, C_ratio)
        H_ratio = out_ior[0]
        C_ratio = out_ior[1]
        out_ior[0] = H_ratio + 1e3
        out_ior[1] = C_ratio + 1e3
        return out_ior
    }

    function get_HK_ior(H_ratio: number, C_ratio: number) {
        const out_ior = [] as unknown as [number, number]
        let line: number, lowRatio: number, nowRatio: number, highRatio: number
        let nowType = ''
        if (H_ratio <= 1e3 && C_ratio <= 1e3) {
            out_ior[0] = Math.floor(H_ratio / 10 + 1e-4) * 10
            out_ior[1] = Math.floor(C_ratio / 10 + 1e-4) * 10
            return out_ior
        }
        line = 2e3 - (H_ratio + C_ratio)
        if (H_ratio > C_ratio) {
            lowRatio = C_ratio
            nowType = 'C'
        } else {
            lowRatio = H_ratio
            nowType = 'H'
        }
        if (2e3 - line - lowRatio > 1e3) nowRatio = (lowRatio + line) * -1
        else nowRatio = 2e3 - line - lowRatio
        if (nowRatio < 0) highRatio = Math.floor(Math.abs(1e3 / nowRatio) * 1e3)
        else highRatio = 2e3 - line - nowRatio
        if (nowType == 'H') {
            out_ior[0] = Math.floor(lowRatio / 10 + 1e-4) * 10
            out_ior[1] = Math.floor(highRatio / 10 + 1e-4) * 10
        } else {
            out_ior[0] = Math.floor(highRatio / 10 + 1e-4) * 10
            out_ior[1] = Math.floor(lowRatio / 10 + 1e-4) * 10
        }
        return out_ior
    }

    function Decimal_point(tmpior: number, show: number) {
        var sign = ''
        sign = tmpior < 0 ? 'Y' : 'N'
        tmpior = Math.floor(Math.abs(tmpior) * show + 1 / show) / show
        return tmpior * (sign == 'Y' ? -1 : 1)
    }

    function printf(vals: number, points: number) {
        let strVals = '' + vals
        var cmd = new Array()
        cmd = strVals.split('.')
        if (cmd.length > 1)
            for (let ii = 0; ii < points - cmd[1].length; ii++) strVals = strVals + '0'
        else {
            strVals = strVals + '.'
            for (let ii = 0; ii < points; ii++) strVals = strVals + '0'
        }
        return strVals
    }

    return chg_ior(value1 as unknown as number, value2 as unknown as number)
}

/**
 * 计算让球值，从皇冠的带/的格式转换为2位小数
 * @param ratio 原始让球数值
 * @param strong 让球方，如果是用来计算大小球，那么传入C
 */
export function changeRatio(ratio: string) {
    let parts = ratio.split('/').map((t) => t.trim())
    if (parts.length === 1) {
        //单个让球值
        return parts[0]
    } else {
        //两个让球值
        return Decimal(parts[0]).add(parts[1]).div(2).toString()
    }
}
