rm -rf Migrations && dotnet ef database drop --force && dotnet ef migrations add InitialCreate && dotnet ef database update && clear && dotnet run
