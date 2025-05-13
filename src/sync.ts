import { QueryTypes } from 'sequelize'
import { Sequelize } from 'sequelize-typescript'
import { Match, Team, Tournament } from './db'

const pgsql = new Sequelize({
    dialect: 'postgres',
    host: '156.230.62.108',
    username: 'postgres',
    password: '8B6dhRLbhpdREdkF',
    database: 'football',
    timezone: '+08:00',
})

async function moveMatches() {
    let lastId = 0
    while (true) {
        const list = await pgsql.query<Record<string, any>>(
            {
                query: 'SELECT * FROM "match" WHERE id > ? ORDER BY id LIMIT 100',
                values: [lastId],
            },
            {
                type: QueryTypes.SELECT,
            },
        )
        for (const row of list) {
            await Match.create({
                id: row.id,
                tournament_id: row.tournament_id,
                crown_match_id: row.crown_match_id,
                team1_id: row.team1_id,
                team2_id: row.team2_id,
                match_time: row.match_time,
                status: row.status,
                error_status: row.error_status,
                has_period1_score: row.has_period1_score ? 1 : 0,
                score1_period1: row.score1_period1,
                score2_period1: row.score2_period1,
                corner1_period1: row.corner1_period1,
                corner2_period1: row.corner2_period1,
                has_score: row.has_score ? 1 : 0,
                score1: row.score1,
                score2: row.score2,
                corner1: row.corner1,
                corner2: row.corner2,
            })
            console.log('迁移比赛', row.id)
        }
        if (list.length < 100) break
        lastId = list[list.length - 1].id
    }
}

async function moveTournaments() {
    let lastId = 0
    while (true) {
        const list = await pgsql.query<Record<string, any>>(
            {
                query: 'SELECT * FROM tournament WHERE id > ? ORDER BY id LIMIT 100',
                values: [lastId],
            },
            {
                type: QueryTypes.SELECT,
            },
        )
        for (const row of list) {
            await Tournament.create({
                id: row.id,
                crown_tournament_id: row.crown_tournament_id,
                name: row.name,
            })
            console.log('迁移联赛', row.id)
        }

        if (list.length < 100) break
        lastId = list[list.length - 1].id
    }
}

async function moveTeams() {
    let lastId = 0
    while (true) {
        const list = await pgsql.query<Record<string, any>>(
            {
                query: 'SELECT * FROM team WHERE id > ? ORDER BY id LIMIT 100',
                values: [lastId],
            },
            {
                type: QueryTypes.SELECT,
            },
        )
        for (const row of list) {
            await Team.create({
                id: row.id,
                crown_team_id: row.crown_team_id,
                name: row.name,
            })
            console.log('迁移队伍', row.id)
        }

        if (list.length < 100) break
        lastId = list[list.length - 1].id
    }
}

async function main() {
    // await moveTournaments()
    // await moveTeams()
    // await moveMatches()

    const [row1] = await pgsql.query<Record<string, any>>(
        {
            query: 'SELECT * FROM "match" ORDER BY id LIMIT 1',
            values: [],
        },
        {
            type: QueryTypes.SELECT,
        },
    )

    const row2 = await Match.findOne({
        order: [['id', 'asc']],
    })

    console.log(row1.match_time)
    console.log(row2!.match_time)
}

main().finally(() => process.exit())
