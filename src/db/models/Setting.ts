import type { InferAttributes } from 'sequelize'
import { Column, DataType, Model, PrimaryKey, Table } from 'sequelize-typescript'

/**
 * 系统配置表
 */
@Table({ tableName: 'setting', timestamps: false })
export class Setting extends Model<InferAttributes<Setting>> {
    /**
     * 配置名
     */
    @PrimaryKey
    @Column(DataType.STRING(100))
    declare name: string

    /**
     * 配置值
     */
    @Column(DataType.TEXT)
    declare value: string
}
