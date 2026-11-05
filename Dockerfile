FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn -q -B dependency:go-offline
COPY src ./src
RUN mvn -q -B package -DskipTests

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/target/job-platform-0.0.1-SNAPSHOT.jar app.jar
RUN groupadd -r app && useradd -r -g app -u 1001 app \
    && apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*
USER app
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
