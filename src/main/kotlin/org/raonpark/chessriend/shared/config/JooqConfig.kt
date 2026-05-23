package org.raonpark.chessriend.shared.config

import org.jooq.DSLContext
import org.jooq.SQLDialect
import org.jooq.impl.DSL
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

@Configuration
class JooqConfig {
    @Bean
    fun dslContext(): DSLContext = DSL.using(SQLDialect.POSTGRES)
}
