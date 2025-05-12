import type { CreationOptional, InferAttributes, InferCreationAttributes } from 'sequelize'
import { AutoIncrement, Column, DataType, Model, PrimaryKey, Table } from 'sequelize-typescript'

/**
 * 队伍表
 */
@Table({ tableName: 'team', timestamps: false })
export class Team extends Model<InferAttributes<Team>, InferCreationAttributes<Team>> {
    /**
     * 队伍id
     */
    @AutoIncrement
    @PrimaryKey
    @Column(DataType.INTEGER)
    declare id: CreationOptional<number>

    /**
     * 皇冠队伍id
     */
    @Column(DataType.STRING)
    declare crown_team_id: string

    /**
     * 球探网球队id
     */
    @Column(DataType.STRING)
    declare titan007_team_id: CreationOptional<string>

    /**
     * 队伍名称
     */
    @Column(DataType.STRING(100))
    declare name: string
}
