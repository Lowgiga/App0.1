import {sqliteTable,text} from 'drizzle-orm/sqlite-core';
export const meshWork = sqliteTable('mesh_work',{
 userId:text('user_id').primaryKey(),
 payload:text('payload').notNull(),
 updatedAt:text('updated_at').notNull(),
});
