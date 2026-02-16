sleep 5
dotnet ef database drop --force
rm -rf Migrations/
dotnet ef migrations add InitialCreate --context AppDbContext
dotnet ef database update
