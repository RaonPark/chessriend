# Suggested Commands

## Backend
```bash
# Run application
./gradlew bootRun

# Run tests
./gradlew test

# Check dependencies
./gradlew dependencies --configuration compileClasspath

# Clean build
./gradlew clean build
```

## Frontend
```bash
# Install dependencies
cd frontend && pnpm install

# Dev server
cd frontend && pnpm dev

# Build
cd frontend && pnpm build

# Test
cd frontend && pnpm test
```

## System (Windows, but using bash shell)
- Use Unix-style commands: ls, find, grep, cat, etc.
- Forward slashes in paths
- /dev/null not NUL

## Note: Java Version
JAVA_HOME is set to Java 8 (for other projects).
This project uses `gradle.properties` to point Gradle to Corretto 25:
```properties
org.gradle.java.home=C:/Users/sumin/.jdks/corretto-25.0.1
```
`gradle.properties` is gitignored — each machine manages it locally.
