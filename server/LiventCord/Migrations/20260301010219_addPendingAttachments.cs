using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LiventCord.Migrations
{
    /// <inheritdoc />
    public partial class addPendingAttachments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PendingAttachments",
                columns: table => new
                {
                    FileId = table.Column<string>(type: "text", nullable: false),
                    UserId = table.Column<string>(type: "text", nullable: false),
                    FileName = table.Column<string>(type: "text", nullable: false),
                    FileSize = table.Column<long>(type: "bigint", nullable: false),
                    Extension = table.Column<string>(type: "text", nullable: false),
                    IsImage = table.Column<bool>(type: "boolean", nullable: false),
                    IsVideo = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Claimed = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PendingAttachments", x => x.FileId);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PendingAttachments");

            migrationBuilder.AddColumn<string>(
                name: "Discriminator",
                table: "UrlMetadata",
                type: "text",
                nullable: false,
                defaultValue: "");
        }
    }
}
