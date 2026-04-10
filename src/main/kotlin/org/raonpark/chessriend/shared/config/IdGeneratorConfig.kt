package org.raonpark.chessriend.shared.config

import org.raonpark.chessriend.shared.id.SnowflakeIdGenerator
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

@Configuration
class IdGeneratorConfig {

    @Bean
    fun snowflakeIdGenerator(): SnowflakeIdGenerator = SnowflakeIdGenerator()
}
