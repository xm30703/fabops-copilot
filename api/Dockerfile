FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY NuGet.Config ./
COPY api/FabOps.Api.csproj api/
RUN dotnet restore api/FabOps.Api.csproj
COPY api/ api/
RUN dotnet publish api/FabOps.Api.csproj --configuration Release --no-restore --output /app

FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=build /app/ ./
ENV ASPNETCORE_URLS=http://0.0.0.0:5080
USER $APP_UID
EXPOSE 5080
ENTRYPOINT ["dotnet", "FabOps.Api.dll"]
