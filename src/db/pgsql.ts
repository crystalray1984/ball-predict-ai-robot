import { Sequelize } from 'sequelize-typescript'
import '../config'
import { Match } from './models/Match'
import { Odd } from './models/Odd'
import { PromotedOdd } from './models/PromotedOdd'
import { Setting } from './models/Setting'
import { Team } from './models/Team'
import { Tournament } from './models/Tournament'
import { SurebetRecord } from './models/SurebetRecord'

export const db = new Sequelize({
    dialect: 'postgres',
    host: process.env.DB_HOST,
    port: process.env.DB_PORT as any,
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    models: [Tournament, Team, Match, Odd, Setting, PromotedOdd, SurebetRecord],
    timezone: '+08:00',
    logging: false,
    pool: {
        min: process.env.DB_POOL_MIN ? Number(process.env.DB_POOL_MIN) : 0,
        max: process.env.DB_POOL_MAX ? Number(process.env.DB_POOL_MAX) : 5,
    },
})
