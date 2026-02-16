rm -rf Migrations && dotnet ef database drop --force && dotnet ef migrations add InitialCreate --context AppDbContext && dotnet ef database update && clear && dotnet run
