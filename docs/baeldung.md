1. Introduction
   In this tutorial, we’ll explore Spring R2DBC Migrations using Flyway, an open-source tool that’s commonly used for database migrations. Although it doesn’t have native support for R2DBC as of this writing, we’ll look at alternative ways to migrate tables and data during application start-up.

2. Basic Spring R2DBC Application
   For this article, we’ll use a simple Spring R2DBC application with migrations using Flyway to create tables and insert data into a PostgreSQL database.

2.1. R2DBC
R2DBC stands for Reactive Relational Database. It’s based on the Reactive Streams specification, which provides a fully-reactive non-blocking API for interacting with SQL databases. However, despite its many benefits, some tools like Flyway don’t currently support R2DBC, which means that a JDBC (blocking) driver is required for migrations using Flyway.

Database migrations allow the application to upgrade the database schema on startup as new versions are deployed. These migrations are required to match the database structure to the application’s needs. Because these changes are required before the app can start, a synchronous blocking migration is acceptable.

2.2. Dependencies
We’ll need a few dependencies to make an R2DBC application compatible with Flyway.


광고


We’ll need the spring-boot-starter-data-r2dbc dependency, which provides core Spring R2DBC data abstractions and the PostgreSQL R2DBC driver:

<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-data-r2dbc</artifactId>
</dependency>
Copy
<dependency>
  <groupId>org.postgresql</groupId>
   <artifactId>r2dbc-postgresql</artifactId>
   <version>1.0.5.RELEASE</version>
</dependency>
Copy
In order to configure database migrations, we’ll need Flyway:

<dependency>
  <groupId>org.flywaydb</groupId>
  <artifactId>flyway-core</artifactId>
  <version>10.12.0</version>
</dependency>
Copy
Since Flyway doesn’t yet support the R2DBC driver, we’ll need to add the standard JDBC driver for PostgreSQL as well:

<dependency>
  <groupId>org.postgresql</groupId>
  <artifactId>postgresql</artifactId>
  <version>42.7.3</version>
</dependency>
Copy
3. Flyway Migration on the Spring R2DBC Application
Let’s look at the configuration required for Flyway migrations and sample scripts.

3.1. Configuration for Spring R2DBC and Flyway
Since Flyway does not work with R2DBC, we’ll need to create the Flyway bean with the init method migrate(), which prompts Spring to run our migrations as soon as it creates the bean:


광고


@Configuration
@EnableConfigurationProperties({ R2dbcProperties.class, FlywayProperties.class })
class DatabaseConfig {
@Bean(initMethod = "migrate")
public Flyway flyway(FlywayProperties flywayProperties, R2dbcProperties r2dbcProperties) {
return Flyway.configure()
.dataSource(
flywayProperties.getUrl(),
r2dbcProperties.getUsername(),
r2dbcProperties.getPassword()
)
.locations(flywayProperties.getLocations()
.stream()
.toArray(String[]::new))
.baselineOnMigrate(true)
.load();
}
}
Copy
We can point Flyway to our database by merging the R2DBC properties with some overrides specific for Flyway, specifically the URL, which must be a JDBC connection URL and the locations Flyway will run migrations from.

In this particular example, Spring is able to auto-configure Postgresql R2DBC based on the dependency in the classpath, but it’s worth noting that R2DBC provides support for other SQL database drivers as well. Since we have the R2DBC starter in our application, we just need to set the appropriate properties for Spring R2DBC, but no additional config is needed.

Let’s see an example of a property file for the R2DBC PostgreSQL and Flyway setup that contains the database URL required for the JDBC driver:

spring:
r2dbc:
username: local
password: local
url: r2dbc:postgresql://localhost:8082/flyway-test-db
flyway:
url: jdbc:postgresql://localhost:8082/flyway-test-db
locations: classpath:db/postgres/migration
Copy
While the default location of the directory is db/migration, the above configuration specifies that our migration scripts are located in the db/postgres/migration directory.

The R2DBC URL format consists of:


광고


jdbc/r2dbc – Connection strategy
postgresql – Database type
localhost:8082 – Host of the PostgreSQL DB
flyway-test-db – Database name
3.2. Migration Scripts
Let’s create migration scripts that create two tables – department and student – and also insert some data into the department table.

Our first script will create the department and student tables. We’ll name it V1_1__create_tables.sql, adhering to the file naming convention so that Flyway can identify it as the first script to execute. Flyway tracks all the scripts that it has run, so it will only run each script once:

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS department
(
ID uuid PRIMARY KEY UNIQUE DEFAULT uuid_generate_v4(),
NAME varchar(255)
);

CREATE TABLE IF NOT EXISTS student
(
ID uuid PRIMARY KEY UNIQUE DEFAULT uuid_generate_v4(),
FIRST_NAME varchar(255),
LAST_NAME varchar(255),
DATE_OF_BIRTH DATE NOT NULL,
DEPARTMENT uuid NOT NULL CONSTRAINT student_foreign_key1 REFERENCES department (ID)
);
Copy
Our next script will insert some data into our tables. We’ll name it V1_2__insert_department.sql so that it runs second:

insert into department(NAME) values ('Computer Science');
insert into department(NAME) values ('Biomedical');
Copy
3.3. Testing Spring R2DBC Migrations
Let’s do a quick test to validate the setup.

First, let’s write a sample docker-compose.yml for starting PostgreSQL DB:

version: '3.9'
networks:
obref:
services:
postgres_db_service:
container_name: postgres_db_service
image: postgres:11
ports:
- "8082:5432"
hostname:   postgres_db_service
environment:
- POSTGRES_PASSWORD=local
- POSTGRES_USER=local
- POSTGRES_DB=flyway-test-db
Copy
The first time we start the application, we should see logs confirming the migrations being applied:

INFO 95740 --- [  restartedMain] o.f.c.internal.license.VersionPrinter    : Flyway Community Edition 9.14.1 by Redgate
INFO 95740 --- [  restartedMain] o.f.c.internal.license.VersionPrinter    : See what's new here: https://flywaydb.org/documentation/learnmore/releaseNotes#9.14.1
INFO 95740 --- [  restartedMain] o.f.c.internal.license.VersionPrinter    :
INFO 95740 --- [  restartedMain] o.f.c.i.database.base.BaseDatabaseType   : Database: jdbc:postgresql://localhost:8082/flyway-test-db (PostgreSQL 11.16)
INFO 95740 --- [  restartedMain] o.f.core.internal.command.DbValidate     : Successfully validated 2 migrations (execution time 00:00.007s)
INFO 95740 --- [  restartedMain] o.f.c.i.s.JdbcTableSchemaHistory         : Creating Schema History table "public"."flyway_schema_history" ...
INFO 95740 --- [  restartedMain] o.f.core.internal.command.DbMigrate      : Current version of schema "public": << Empty Schema >>
INFO 95740 --- [  restartedMain] o.f.core.internal.command.DbMigrate      : Migrating schema "public" to version "1.1 - create tables"
INFO 95740 --- [  restartedMain] o.f.core.internal.command.DbMigrate      : Migrating schema "public" to version "1.2 - insert department"
INFO 95740 --- [  restartedMain] o.f.core.internal.command.DbMigrate      : Successfully applied 2 migrations to schema "public", now at version v1.2 (execution time 00:00.045s)
INFO 95740 --- [  restartedMain] o.s.b.web.embedded.netty.NettyWebServer  : Netty started on port 8080
INFO 95740 --- [  restartedMain] c.b.e.r.f.SpringWebfluxFlywayApplication : Started SpringWebfluxFlywayApplication in 1.895 seconds (JVM running for 2.28)
Copy
We can see from the above logs that the migration scripts are applied in the expected order.

If the flyway_schema_history table is not available, then Flyway creates it and stores the details of the migration status. Once the script completes, we can view details about the migrations from this table, including the name of the file and the time of execution.

