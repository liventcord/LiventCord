using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace LiventCord.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Discriminator",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Nickname = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    Value = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Discriminator", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "FileBase",
                columns: table => new
                {
                    FileId = table.Column<string>(type: "text", nullable: false),
                    FileName = table.Column<string>(type: "text", nullable: true),
                    GuildId = table.Column<string>(type: "text", nullable: true),
                    Content = table.Column<byte[]>(type: "bytea", nullable: false),
                    Extension = table.Column<string>(type: "text", nullable: false),
                    FileType = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ContentHash = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FileBase", x => x.FileId);
                });

            migrationBuilder.CreateTable(
                name: "Friend",
                columns: table => new
                {
                    UserId = table.Column<string>(type: "text", nullable: false),
                    FriendId = table.Column<string>(type: "text", nullable: false),
                    Status = table.Column<int>(type: "integer", maxLength: 20, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Friend", x => new { x.UserId, x.FriendId });
                });

            migrationBuilder.CreateTable(
                name: "Guild",
                columns: table => new
                {
                    GuildId = table.Column<string>(type: "text", nullable: false),
                    OwnerId = table.Column<string>(type: "text", nullable: false),
                    GuildName = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    RootChannel = table.Column<string>(type: "text", nullable: false),
                    Region = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    Settings = table.Column<string>(type: "character varying(1024)", maxLength: 1024, nullable: true),
                    IsGuildUploadedImg = table.Column<bool>(type: "boolean", nullable: false),
                    is_public = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Guild", x => x.GuildId);
                });

            migrationBuilder.CreateTable(
                name: "GuildInvites",
                columns: table => new
                {
                    InviteId = table.Column<string>(type: "text", nullable: false),
                    GuildId = table.Column<string>(type: "text", nullable: false),
                    InviteChannelId = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GuildInvites", x => x.InviteId);
                });

            migrationBuilder.CreateTable(
                name: "MediaUrls",
                columns: table => new
                {
                    Url = table.Column<string>(type: "text", nullable: false),
                    IsImage = table.Column<bool>(type: "boolean", nullable: false),
                    IsVideo = table.Column<bool>(type: "boolean", nullable: false),
                    FileName = table.Column<string>(type: "text", nullable: false),
                    FileSize = table.Column<long>(type: "bigint", nullable: false),
                    Width = table.Column<int>(type: "integer", nullable: true),
                    Height = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MediaUrls", x => x.Url);
                });

            migrationBuilder.CreateTable(
                name: "MessageUrls",
                columns: table => new
                {
                    MessageId = table.Column<string>(type: "text", nullable: false),
                    Urls = table.Column<List<string>>(type: "text[]", nullable: true),
                    ChannelId = table.Column<string>(type: "text", nullable: false),
                    GuildId = table.Column<string>(type: "text", nullable: true),
                    UserId = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MessageUrls", x => x.MessageId);
                });

            migrationBuilder.CreateTable(
                name: "UrlMetadata",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Domain = table.Column<string>(type: "text", nullable: false),
                    RoutePath = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Type = table.Column<string>(type: "text", nullable: true),
                    PinnerUserId = table.Column<string>(type: "text", nullable: true),
                    PinnedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Title = table.Column<string>(type: "text", nullable: true),
                    Description = table.Column<string>(type: "text", nullable: true),
                    SiteName = table.Column<string>(type: "text", nullable: true),
                    Image = table.Column<string>(type: "text", nullable: true),
                    Url = table.Column<string>(type: "text", nullable: true),
                    Keywords = table.Column<string>(type: "text", nullable: true),
                    Author = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UrlMetadata", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "User",
                columns: table => new
                {
                    UserId = table.Column<string>(type: "text", nullable: false),
                    Email = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    is_google_user = table.Column<bool>(type: "boolean", nullable: false),
                    google_id = table.Column<string>(type: "text", nullable: true),
                    discriminator = table.Column<string>(type: "character varying(4)", maxLength: 4, nullable: false),
                    Password = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    Nickname = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    bot = table.Column<int>(type: "integer", nullable: false),
                    description = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    last_login = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    date_of_birth = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    verified = table.Column<int>(type: "integer", nullable: false),
                    location = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    language = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    social_media_links = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_User", x => x.UserId);
                });

            migrationBuilder.CreateTable(
                name: "AttachmentFile",
                columns: table => new
                {
                    FileId = table.Column<string>(type: "text", nullable: false),
                    ChannelId = table.Column<string>(type: "text", nullable: false),
                    UserId = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AttachmentFile", x => x.FileId);
                    table.ForeignKey(
                        name: "FK_AttachmentFile_FileBase_FileId",
                        column: x => x.FileId,
                        principalTable: "FileBase",
                        principalColumn: "FileId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "EmojiFile",
                columns: table => new
                {
                    FileId = table.Column<string>(type: "text", nullable: false),
                    UserId = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EmojiFile", x => x.FileId);
                    table.ForeignKey(
                        name: "FK_EmojiFile_FileBase_FileId",
                        column: x => x.FileId,
                        principalTable: "FileBase",
                        principalColumn: "FileId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "GuildFile",
                columns: table => new
                {
                    FileId = table.Column<string>(type: "text", nullable: false),
                    UserId = table.Column<string>(type: "text", nullable: false),
                    Version = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GuildFile", x => x.FileId);
                    table.ForeignKey(
                        name: "FK_GuildFile_FileBase_FileId",
                        column: x => x.FileId,
                        principalTable: "FileBase",
                        principalColumn: "FileId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ProfileFile",
                columns: table => new
                {
                    FileId = table.Column<string>(type: "text", nullable: false),
                    UserId = table.Column<string>(type: "text", nullable: false),
                    Version = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProfileFile", x => x.FileId);
                    table.ForeignKey(
                        name: "FK_ProfileFile_FileBase_FileId",
                        column: x => x.FileId,
                        principalTable: "FileBase",
                        principalColumn: "FileId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Channel",
                columns: table => new
                {
                    ChannelId = table.Column<string>(type: "text", nullable: false),
                    ChannelName = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    ChannelDescription = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    IsTextChannel = table.Column<bool>(type: "boolean", nullable: false),
                    is_private = table.Column<bool>(type: "boolean", nullable: false),
                    LastReadDateTime = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    GuildId = table.Column<string>(type: "text", nullable: true),
                    recipient_id = table.Column<string>(type: "text", nullable: true),
                    Order = table.Column<int>(type: "integer", nullable: false),
                    channel_version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Channel", x => x.ChannelId);
                    table.ForeignKey(
                        name: "FK_Channel_Guild_GuildId",
                        column: x => x.GuildId,
                        principalTable: "Guild",
                        principalColumn: "GuildId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "GuildMembers",
                columns: table => new
                {
                    guild_id = table.Column<string>(type: "text", nullable: false),
                    user_id = table.Column<string>(type: "text", nullable: false),
                    UserId = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GuildMembers", x => new { x.guild_id, x.user_id });
                    table.ForeignKey(
                        name: "FK_GuildMembers_Guild_guild_id",
                        column: x => x.guild_id,
                        principalTable: "Guild",
                        principalColumn: "GuildId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_GuildMembers_User_UserId",
                        column: x => x.UserId,
                        principalTable: "User",
                        principalColumn: "UserId");
                    table.ForeignKey(
                        name: "FK_GuildMembers_User_user_id",
                        column: x => x.user_id,
                        principalTable: "User",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "GuildPermissions",
                columns: table => new
                {
                    guild_id = table.Column<string>(type: "text", nullable: false),
                    user_id = table.Column<string>(type: "text", nullable: false),
                    Permissions = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GuildPermissions", x => new { x.guild_id, x.user_id });
                    table.ForeignKey(
                        name: "FK_GuildPermissions_Guild_guild_id",
                        column: x => x.guild_id,
                        principalTable: "Guild",
                        principalColumn: "GuildId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_GuildPermissions_User_user_id",
                        column: x => x.user_id,
                        principalTable: "User",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "UserDm",
                columns: table => new
                {
                    user_id = table.Column<string>(type: "text", nullable: false),
                    friend_id = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserDm", x => new { x.user_id, x.friend_id });
                    table.ForeignKey(
                        name: "FK_UserDm_User_friend_id",
                        column: x => x.friend_id,
                        principalTable: "User",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_UserDm_User_user_id",
                        column: x => x.user_id,
                        principalTable: "User",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "message",
                columns: table => new
                {
                    message_id = table.Column<string>(type: "text", nullable: false),
                    UserId = table.Column<string>(type: "text", nullable: false),
                    ChannelId = table.Column<string>(type: "text", nullable: false),
                    Content = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    Date = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastEdited = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ReplyToId = table.Column<string>(type: "text", nullable: true),
                    ReactionEmojisIds = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    Metadata = table.Column<string>(type: "json", nullable: true),
                    IsSystemMessage = table.Column<bool>(type: "boolean", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_message", x => x.message_id);
                    table.ForeignKey(
                        name: "FK_message_Channel_ChannelId",
                        column: x => x.ChannelId,
                        principalTable: "Channel",
                        principalColumn: "ChannelId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_message_User_UserId",
                        column: x => x.UserId,
                        principalTable: "User",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "UserChannel",
                columns: table => new
                {
                    UserId = table.Column<string>(type: "text", nullable: false),
                    ChannelId = table.Column<string>(type: "text", nullable: false),
                    LastReadDatetime = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserChannel", x => new { x.UserId, x.ChannelId });
                    table.ForeignKey(
                        name: "FK_UserChannel_Channel_ChannelId",
                        column: x => x.ChannelId,
                        principalTable: "Channel",
                        principalColumn: "ChannelId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_UserChannel_User_UserId",
                        column: x => x.UserId,
                        principalTable: "User",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Attachments",
                columns: table => new
                {
                    FileId = table.Column<string>(type: "text", nullable: false),
                    IsImageFile = table.Column<bool>(type: "boolean", nullable: false),
                    IsVideoFile = table.Column<bool>(type: "boolean", nullable: true),
                    MessageId = table.Column<string>(type: "text", nullable: false),
                    FileName = table.Column<string>(type: "text", nullable: false),
                    FileSize = table.Column<long>(type: "bigint", nullable: false),
                    IsSpoiler = table.Column<bool>(type: "boolean", nullable: false),
                    IsProxyFile = table.Column<bool>(type: "boolean", nullable: true),
                    ProxyUrl = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Attachments", x => x.FileId);
                    table.ForeignKey(
                        name: "FK_Attachments_message_MessageId",
                        column: x => x.MessageId,
                        principalTable: "message",
                        principalColumn: "message_id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ChannelPinnedMessage",
                columns: table => new
                {
                    ChannelId = table.Column<string>(type: "text", nullable: false),
                    MessageId = table.Column<string>(type: "text", nullable: false),
                    PinnedByUserId = table.Column<string>(type: "text", nullable: true),
                    PinnedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ChannelPinnedMessage", x => new { x.ChannelId, x.MessageId });
                    table.ForeignKey(
                        name: "FK_ChannelPinnedMessage_Channel_ChannelId",
                        column: x => x.ChannelId,
                        principalTable: "Channel",
                        principalColumn: "ChannelId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ChannelPinnedMessage_message_MessageId",
                        column: x => x.MessageId,
                        principalTable: "message",
                        principalColumn: "message_id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Embed",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    MessageId = table.Column<string>(type: "text", nullable: false),
                    Title = table.Column<string>(type: "text", nullable: true),
                    Type = table.Column<string>(type: "text", nullable: true, defaultValue: "Rich"),
                    Description = table.Column<string>(type: "text", nullable: true),
                    Url = table.Column<string>(type: "text", nullable: true),
                    Color = table.Column<int>(type: "integer", nullable: true, defaultValue: 8421504),
                    Fields = table.Column<string>(type: "json", nullable: false),
                    Thumbnail_Url = table.Column<string>(type: "text", nullable: true),
                    Thumbnail_ProxyUrl = table.Column<string>(type: "text", nullable: true),
                    Thumbnail_Width = table.Column<int>(type: "integer", nullable: true),
                    Thumbnail_Height = table.Column<int>(type: "integer", nullable: true),
                    Video_Url = table.Column<string>(type: "text", nullable: true),
                    Video_Width = table.Column<int>(type: "integer", nullable: true),
                    Video_Height = table.Column<int>(type: "integer", nullable: true),
                    Video_ProxyUrl = table.Column<string>(type: "text", nullable: true),
                    Author_Name = table.Column<string>(type: "text", nullable: true),
                    Author_Url = table.Column<string>(type: "text", nullable: true),
                    Author_IconUrl = table.Column<string>(type: "text", nullable: true),
                    Image_Url = table.Column<string>(type: "text", nullable: true),
                    Image_ProxyUrl = table.Column<string>(type: "text", nullable: true),
                    Image_Width = table.Column<int>(type: "integer", nullable: true),
                    Image_Height = table.Column<int>(type: "integer", nullable: true),
                    Footer_Text = table.Column<string>(type: "text", nullable: true),
                    Footer_IconUrl = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Embed", x => new { x.MessageId, x.Id });
                    table.ForeignKey(
                        name: "FK_Embed_message_MessageId",
                        column: x => x.MessageId,
                        principalTable: "message",
                        principalColumn: "message_id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Attachments_MessageId",
                table: "Attachments",
                column: "MessageId");

            migrationBuilder.CreateIndex(
                name: "IX_Channel_ChannelId_GuildId",
                table: "Channel",
                columns: new[] { "ChannelId", "GuildId" });

            migrationBuilder.CreateIndex(
                name: "IX_Channel_GuildId",
                table: "Channel",
                column: "GuildId");

            migrationBuilder.CreateIndex(
                name: "IX_ChannelPinnedMessage_MessageId",
                table: "ChannelPinnedMessage",
                column: "MessageId");

            migrationBuilder.CreateIndex(
                name: "IX_Discriminator_Nickname_Value",
                table: "Discriminator",
                columns: new[] { "Nickname", "Value" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_FileBase_CreatedAt",
                table: "FileBase",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_Guild_OwnerId",
                table: "Guild",
                column: "OwnerId");

            migrationBuilder.CreateIndex(
                name: "IX_GuildMembers_user_id",
                table: "GuildMembers",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "IX_GuildMembers_UserId",
                table: "GuildMembers",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_GuildPermissions_user_id",
                table: "GuildPermissions",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "IX_message_ChannelId_Date_message_id",
                table: "message",
                columns: new[] { "ChannelId", "Date", "message_id" });

            migrationBuilder.CreateIndex(
                name: "IX_message_UserId",
                table: "message",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_ProfileFile_UserId",
                table: "ProfileFile",
                column: "UserId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_User_Email",
                table: "User",
                column: "Email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_UserChannel_ChannelId",
                table: "UserChannel",
                column: "ChannelId");

            migrationBuilder.CreateIndex(
                name: "IX_UserDm_friend_id",
                table: "UserDm",
                column: "friend_id");

            migrationBuilder.CreateIndex(
                name: "IX_UserDm_user_id",
                table: "UserDm",
                column: "user_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AttachmentFile");

            migrationBuilder.DropTable(
                name: "Attachments");

            migrationBuilder.DropTable(
                name: "ChannelPinnedMessage");

            migrationBuilder.DropTable(
                name: "Discriminator");

            migrationBuilder.DropTable(
                name: "Embed");

            migrationBuilder.DropTable(
                name: "EmojiFile");

            migrationBuilder.DropTable(
                name: "Friend");

            migrationBuilder.DropTable(
                name: "GuildFile");

            migrationBuilder.DropTable(
                name: "GuildInvites");

            migrationBuilder.DropTable(
                name: "GuildMembers");

            migrationBuilder.DropTable(
                name: "GuildPermissions");

            migrationBuilder.DropTable(
                name: "MediaUrls");

            migrationBuilder.DropTable(
                name: "MessageUrls");

            migrationBuilder.DropTable(
                name: "ProfileFile");

            migrationBuilder.DropTable(
                name: "UrlMetadata");

            migrationBuilder.DropTable(
                name: "UserChannel");

            migrationBuilder.DropTable(
                name: "UserDm");

            migrationBuilder.DropTable(
                name: "message");

            migrationBuilder.DropTable(
                name: "FileBase");

            migrationBuilder.DropTable(
                name: "Channel");

            migrationBuilder.DropTable(
                name: "User");

            migrationBuilder.DropTable(
                name: "Guild");
        }
    }
}
