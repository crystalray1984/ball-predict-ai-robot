import type { CreationOptional, InferAttributes } from 'sequelize'
import {
    AutoIncrement,
    Column,
    CreatedAt,
    DataType,
    Model,
    PrimaryKey,
    Table,
    UpdatedAt,
} from 'sequelize-typescript'

/**
 * 皇冠账号表
 */
@Table({ tableName: 'crown_account' })
export class CrownAccount extends Model<
    InferAttributes<CrownAccount>,
    InferAttributes<CrownAccount>
> {
    @AutoIncrement
    @PrimaryKey
    @Column(DataType.INTEGER)
    declare id: CreationOptional<number>

    @Column(DataType.STRING)
    declare username: string

    @Column(DataType.STRING)
    declare password: string

    @Column(DataType.TINYINT)
    declare status: number

    @Column(DataType.STRING)
    declare use_by: string

    @Column(DataType.DATE)
    declare use_expires: CreationOptional<Date | null>

    @CreatedAt
    @Column(DataType.DATE)
    declare created_at: CreationOptional<Date | null>

    @UpdatedAt
    @Column(DataType.DATE)
    declare updated_at: CreationOptional<Date | null>
}
