import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import Decimal from 'decimal.js'
import { XMLParser } from 'fast-xml-parser'
import { URL } from 'node:url'
import puppeteer, { Browser, Page } from 'puppeteer'
import { delay } from '../common/helpers'
import { CONFIG } from '../config'
import { CrownAccount, db } from '../db'
import { machineIdSync } from 'node-machine-id'
import { Op, literal } from 'sequelize'

dayjs.extend(utc)
dayjs.extend(timezone)

/**
 * 皇冠首页地址
 */
const PAGE_URL = new URL('/', CONFIG.crown_url ?? 'https://mos011.com').href

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
            if (element) return true
            if (cancelToken?.aborted) return false
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

let browser: Browser = undefined as unknown as Browser
/**
 * 皇冠主页面
 */
let mainPage: Page = undefined as unknown as Page
/**
 * 页面上次初始化的时间
 */
let lastActiveTime = 0
/**
 * 皇冠账号
 */
let account = undefined as unknown as CrownAccount
/**
 * 皇冠账号定时器
 */
let accountTimer: NodeJS.Timeout = undefined as unknown as NodeJS.Timeout

/**
 * 设备ID
 */
const MACHINE_ID = machineIdSync()

/**
 * 获取皇冠账号
 */
async function getCrownAccount() {
    const acc = await db.transaction(async (transaction) => {
        //先尝试返回当前使用的账号
        let acc = await CrownAccount.findOne({
            where: {
                status: 1,
                use_by: MACHINE_ID,
            },
            lock: transaction.LOCK.UPDATE,
            transaction,
        })

        if (acc) {
            await CrownAccount.update(
                {
                    use_expires: new Date(Date.now() + 300000),
                },
                {
                    where: {
                        id: acc.id,
                    },
                    transaction,
                },
            )
            return acc
        }

        //尝试寻找其他可用账号
        acc = await CrownAccount.findOne({
            where: {
                [Op.and]: [
                    { status: 1 },
                    {
                        [Op.or]: [
                            { use_by: '' },
                            {
                                use_expires: {
                                    [Op.lt]: literal('CURRENT_TIMESTAMP'),
                                },
                            },
                        ],
                    },
                ],
            },
            order: literal('RAND()'),
            lock: transaction.LOCK.UPDATE,
            transaction,
        })

        if (acc) {
            await CrownAccount.update(
                {
                    use_by: MACHINE_ID,
                    use_expires: new Date(Date.now() + 300000),
                },
                {
                    where: {
                        id: acc.id,
                    },
                    transaction,
                },
            )
        }
        return acc
    })

    if (!acc) {
        throw new Error('没有可用的皇冠账号')
    }

    accountTimer = setInterval(async () => {
        if (account) {
            await CrownAccount.update(
                {
                    use_expires: new Date(Date.now() + 300000),
                },
                {
                    where: {
                        id: account.id,
                        use_by: MACHINE_ID,
                    },
                },
            )
        }
    }, 120000)

    return acc
}

/**
 * 释放皇冠账号
 */
async function freeCrownAccount() {
    clearInterval(accountTimer)
    if (account) {
        await CrownAccount.update(
            {
                use_by: '',
            },
            {
                where: {
                    id: account.id,
                    use_by: MACHINE_ID,
                },
            },
        )
        account = undefined as unknown as CrownAccount
    }
}

let initPromise = undefined as unknown as Promise<void>
/**
 * 初始化皇冠浏览器环境
 */
export async function init() {
    if (initPromise) return initPromise
    initPromise = _init()
    initPromise.finally(() => {
        initPromise = undefined as unknown as Promise<void>
    })
    return initPromise
}

async function _init() {
    if (browser) {
        await browser.close()
        mainPage = undefined as unknown as Page
        browser = undefined as unknown as Browser
        await freeCrownAccount()
    }

    account = await getCrownAccount()
    console.log('使用皇冠账号', account.username)

    const args: string[] = ['--no-sandbox', '--disable-images', '--lang=zh-cn']

    browser = await puppeteer.launch({
        headless: false,
        args,
    })

    const page = await browser.newPage()
    await page.goto(PAGE_URL)
    console.log('page navigated')

    //等待登录脚本完成
    await page.waitForSelector('#usr')
    console.log('login form ready')
    await page.locator('#usr').fill(account.username)
    await page.locator('#pwd').fill(account.password)
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
async function ready(skipable = false) {
    if (!mainPage) {
        await init()
    } else if (!skipable && Date.now() - lastActiveTime >= 900000) {
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
    ignoreAttributes: false,
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
    skipable = false,
): Promise<Crown.Resp> {
    console.log('发起皇冠请求', crown_match_id, show_type, skipable ? '' : 'skipable')
    await ready(skipable)

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
    skipable = false,
): Promise<Crown.Resp> {
    let tryCount = 3
    while (true) {
        try {
            return await _getCrownData(crown_match_id, show_type, skipable)
        } catch (err) {
            console.error(err)
            console.log(err)
            console.log('重试次数', tryCount)
            tryCount--
            if (tryCount <= 0) {
                throw err
            }
            if (!skipable) {
                await reset()
            }
        }
    }
}

/**
 * 重置皇冠抓取环境
 */
export async function reset() {
    if (browser) {
        await browser.close()
        mainPage = undefined as unknown as Page
        browser = undefined as unknown as Browser
        await freeCrownAccount()
    }
    lastActiveTime = 0
}

/**
 * 抓取皇冠比赛列表
 */
export async function getCrownMatches(): Promise<Required<Crown.MatchInfo>[]> {
    await ready(true)

    const func = `
(function () {
    var par = top.param;
    par += "&p=get_league_list_All";
    par += "&gtype=FT";
    par += "&showtype=fu";
    par += "&FS=N";
    par += "&rtype=r";
    par += "&date=all";
    par += "&nocp=N";
    par += "&ts=" + Date.now();

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
    console.log('抓取皇冠联赛列表完成')
    const leagueList = parser.parse(resp).serverresponse

    if (
        !leagueList.coupons ||
        leagueList.coupons.coupon_sw !== 'Y' ||
        !Array.isArray(leagueList.coupons.coupon) ||
        leagueList.coupons.coupon.length === 0
    ) {
        console.log('没有找到皇冠比赛数据')
        return []
    }

    //联赛id列表
    const lid = leagueList.coupons.coupon[0].lid

    //读取联赛列表
    await delay(1000)

    const func2 = `
(function () {
    var par = top.param;
    par += "&p=get_game_list";
    par += "&p3type=";
    par += "&date=1";
    par += "&gtype=ft";
    par += "&showtype=early";
    par += "&rtype=r";
    par += "&ltype=" + top["userData"].ltype;
    par += "&filter=";
    par += "&cupFantasy=N";
    par += "&lid=" + ${JSON.stringify(lid)};
    par += "&field=cp1";
    par += "&action=clickCoupon";
    par += "&sorttype=L";
    par += "&specialClick=";
    par += "&isFantasy=N";
    par += "&ts=" + Date.now();

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
    const respList = (await mainPage.evaluate(func2)) as string
    console.log('抓取皇冠比赛列表完成')
    const gameList = parser.parse(respList).serverresponse

    if (!Array.isArray(gameList.ec) || gameList.ec.length === 0) {
        console.log('未读取到皇冠比赛列表')
        return []
    }

    const result: Required<Crown.MatchInfo>[] = []

    gameList.ec.forEach((ec: Record<string, any>) => {
        if (ec['@_hasEC'] !== 'Y' || !ec.game || ec.game.ISFANTASY === 'Y') return
        const game = ec.game as Record<string, string>
        result.push({
            lid: game.LID,
            league: game.LEAGUE,
            team_id_h: game.TEAM_H_ID,
            team_id_c: game.TEAM_C_ID,
            team_h: game.TEAM_H,
            team_c: game.TEAM_C,
            ecid: game.ECID,
            match_time: parseMatchTime(game.SYSTIME, game.DATETIME),
        })
    })

    return result
}

function parseMatchTime(SYSTIME: string, DATETIME: string) {
    const timeMatch = /([0-9]+)-([0-9]+) ([0-9]+):([0-9]+)(a|p)/.exec(DATETIME)!

    let hour = parseInt(timeMatch[3])
    if (timeMatch[5] === 'p') {
        hour += 12
    }

    const baseTime = dayjs.tz(SYSTIME, 'America/New_York')
    let matchTime = dayjs.tz(
        `${baseTime.year()}-${timeMatch[1]}-${timeMatch[2]} ${hour.toString().padStart(2, '0')}:${timeMatch[4]}`,
        'America/New_York',
    )

    //比赛时间不应小于当前时间，否则就年份+1
    if (matchTime.valueOf() < baseTime.valueOf()) {
        matchTime = matchTime.add(1, 'year')
    }

    return matchTime.toDate()
}
