using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LiventCord.Migrations
{
    /// <inheritdoc />
    public partial class AddInviteCreatorAndUsages : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CreatedByUserId",
                table: "GuildInvites",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "Usages",
                table: "GuildInvites",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CreatedByUserId",
                table: "GuildInvites");

            migrationBuilder.DropColumn(
                name: "Usages",
                table: "GuildInvites");
        }
    }
}
