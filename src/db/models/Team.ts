import type { CreationOptional, InferAttributes, InferCreationAttributes } from 'sequelize'
import { Column, CreatedAt, DataType, Model, Table, UpdatedAt } from 'sequelize-typescript'

/**
 * 队伍表
 */
@Table({ tableName: 'team' })
export class Team extends Model<InferAttributes<Team>, InferCreationAttributes<Team>> {
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
     * 皇冠队伍id
     */
    @Column(DataType.INTEGER)
    declare crown_team_id: number

    /**
     * 队伍名称
     */
    @Column(DataType.STRING(100))
    declare name: string

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
}
