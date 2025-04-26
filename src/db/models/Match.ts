import {
    type CreationOptional,
    type InferAttributes,
    type InferCreationAttributes,
} from 'sequelize'
import {
    Column,
    CreatedAt,
    DataType,
    ForeignKey,
    HasMany,
    Model,
    Table,
    UpdatedAt,
} from 'sequelize-typescript'
import { Odd } from './Odd'
import { Team } from './Team'
import { Tournament } from './Tournament'
import dayjs from 'dayjs'

/**
 * 比赛表
 */
@Table({ tableName: 'match' })
export class Match extends Model<InferAttributes<Match>, InferCreationAttributes<Match>> {
    /**
     * 队伍id
     */
    @Column({
        type: DataType.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        autoIncrementIdentity: true,
    })
    declare id: CreationOptional<number>

    /**
     * 赛事id
     */
    @Column(DataType.INTEGER)
    declare tournament_id: number

    /**
     * 皇冠比赛id
     */
    @Column(DataType.INTEGER)
    declare crown_match_id: number

    /**
     * 主队id
     */
    @ForeignKey(() => Team)
    @Column(DataType.INTEGER)
    declare team1_id: number

    declare team1: CreationOptional<Team>

    /**
     * 客队id
     */
    @ForeignKey(() => Team)
    @Column(DataType.INTEGER)
    declare team2_id: number

    declare team2: CreationOptional<Team>

    /**
     * 比赛时间
     */
    @Column(DataType.DATE)
    declare match_time: Date

    /**
     * 记录创建时间
     */
    @CreatedAt
    @Column(DataType.DATE)
    declare created_at: CreationOptional<Date>

    /**
     * 记录更新时间
     */
    @UpdatedAt
    @Column(DataType.DATE)
    declare updated_at: CreationOptional<Date>

    @HasMany(() => Odd)
    declare odds: CreationOptional<Odd[]>

    /**
     * 比赛的推荐状态
     */
    @Column(DataType.STRING(50))
    declare status: CreationOptional<string>

    @Column(DataType.INTEGER)
    declare score1: CreationOptional<number>

    @Column(DataType.INTEGER)
    declare score2: CreationOptional<number>

    @Column(DataType.INTEGER)
    declare score1_period1: CreationOptional<number>

    @Column(DataType.INTEGER)
    declare score2_period1: CreationOptional<number>

    @Column(DataType.INTEGER)
    declare corner1: CreationOptional<number>

    @Column(DataType.INTEGER)
    declare corner2: CreationOptional<number>

    @Column(DataType.INTEGER)
    declare corner1_period1: CreationOptional<number>

    @Column(DataType.INTEGER)
    declare corner2_period1: CreationOptional<number>

    @Column(DataType.BOOLEAN)
    declare has_score: CreationOptional<boolean>

    /**
     * 创建比赛数据
     * @param info
     */
    static async createMatch(info: Required<Crown.MatchInfo>): Promise<number> {
        const crown_match_id = parseInt(info.ecid)

        let match = await Match.findOne({
            where: {
                crown_match_id,
            },
            attributes: ['id', 'match_time'],
        })

        if (match) {
            if (match.match_time.valueOf() !== dayjs(info.match_time).valueOf()) {
                //更新比赛时间
                await Match.update(
                    {
                        match_time: dayjs(info.match_time).toDate(),
                    },
                    {
                        where: {
                            id: match.id,
                        },
                    },
                )
            }
            return match.id
        }

        //获取赛事id
        let tournament = await Tournament.findOne({
            where: {
                crown_tournament_id: parseInt(info.lid),
            },
        })
        if (!tournament) {
            tournament = await Tournament.create({
                crown_tournament_id: parseInt(info.lid),
                name: info.league,
            })
        }

        //获取队伍id
        let team1 = await Team.findOne({
            where: {
                crown_team_id: parseInt(info.team_id_h),
            },
        })
        if (!team1) {
            team1 = await Team.create({
                crown_team_id: parseInt(info.team_id_h),
                name: info.team_h,
            })
        }
        let team2 = await Team.findOne({
            where: {
                crown_team_id: parseInt(info.team_id_c),
            },
        })
        if (!team2) {
            team2 = await Team.create({
                crown_team_id: parseInt(info.team_id_c),
                name: info.team_c,
            })
        }

        //插入赛事
        match = await Match.create(
            {
                tournament_id: tournament.id,
                crown_match_id,
                team1_id: team1.id,
                team2_id: team2.id,
                match_time: dayjs(info.match_time).toDate(),
            },
            {
                returning: ['id'],
            },
        )

        return match.id
    }
}
