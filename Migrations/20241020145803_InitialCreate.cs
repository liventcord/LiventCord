﻿using System;
using System.Text.Json;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace MyPostgresApp.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "attachment_files",
                columns: table => new
                {
                    fileid = table.Column<string>(name: "file_id", type: "text", nullable: false),
                    filename = table.Column<string>(name: "file_name", type: "text", nullable: false),
                    guildid = table.Column<string>(name: "guild_id", type: "text", nullable: true),
                    channelid = table.Column<string>(name: "channel_id", type: "text", nullable: true),
                    content = table.Column<byte[]>(type: "bytea", nullable: false),
                    extension = table.Column<string>(type: "text", nullable: false),
                    userid = table.Column<string>(name: "user_id", type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_attachment_files", x => x.fileid);
                });

            migrationBuilder.CreateTable(
                name: "discriminators",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    nickname = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    value = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_discriminators", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "emoji_files",
                columns: table => new
                {
                    fileid = table.Column<string>(name: "file_id", type: "text", nullable: false),
                    filename = table.Column<string>(name: "file_name", type: "text", nullable: false),
                    guildid = table.Column<string>(name: "guild_id", type: "text", nullable: true),
                    content = table.Column<byte[]>(type: "bytea", nullable: false),
                    extension = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_emoji_files", x => x.fileid);
                });

            migrationBuilder.CreateTable(
                name: "friends",
                columns: table => new
                {
                    userid = table.Column<string>(name: "user_id", type: "text", nullable: false),
                    friendid = table.Column<string>(name: "friend_id", type: "text", nullable: false),
                    status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_friends", x => new { x.userid, x.friendid });
                });

            migrationBuilder.CreateTable(
                name: "guilds",
                columns: table => new
                {
                    guildid = table.Column<string>(name: "guild_id", type: "text", nullable: false),
                    ownerid = table.Column<string>(name: "owner_id", type: "text", nullable: false),
                    guildname = table.Column<string>(name: "guild_name", type: "text", nullable: false),
                    createdat = table.Column<DateTime>(name: "created_at", type: "timestamp with time zone", nullable: false),
                    rootchannel = table.Column<string>(name: "root_channel", type: "text", nullable: false),
                    region = table.Column<string>(type: "text", nullable: true),
                    settings = table.Column<string>(type: "text", nullable: true),
                    isguilduploadedimg = table.Column<bool>(name: "is_guild_uploaded_img", type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_guilds", x => x.guildid);
                });

            migrationBuilder.CreateTable(
                name: "guilds_files",
                columns: table => new
                {
                    fileid = table.Column<string>(name: "file_id", type: "text", nullable: false),
                    filename = table.Column<string>(name: "file_name", type: "text", nullable: false),
                    guildid = table.Column<string>(name: "guild_id", type: "text", nullable: true),
                    channelid = table.Column<string>(name: "channel_id", type: "text", nullable: true),
                    userid = table.Column<string>(name: "user_id", type: "text", nullable: true),
                    content = table.Column<byte[]>(type: "bytea", nullable: false),
                    extension = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_guilds_files", x => x.fileid);
                });

            migrationBuilder.CreateTable(
                name: "Message",
                columns: table => new
                {
                    messageid = table.Column<string>(name: "message_id", type: "text", nullable: false),
                    userid = table.Column<string>(name: "user_id", type: "text", nullable: false),
                    content = table.Column<string>(type: "text", nullable: false),
                    channelid = table.Column<string>(name: "channel_id", type: "text", nullable: false),
                    date = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    lastedited = table.Column<DateTime>(name: "last_edited", type: "timestamp with time zone", nullable: true),
                    attachmenturls = table.Column<string>(name: "attachment_urls", type: "text", nullable: true),
                    replytoid = table.Column<string>(name: "reply_to_id", type: "text", nullable: true),
                    reactionemojisids = table.Column<string>(name: "reaction_emojis_ids", type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Message", x => x.messageid);
                });

            migrationBuilder.CreateTable(
                name: "profile_files",
                columns: table => new
                {
                    fileid = table.Column<string>(name: "file_id", type: "text", nullable: false),
                    filename = table.Column<string>(name: "file_name", type: "text", nullable: false),
                    guildid = table.Column<string>(name: "guild_id", type: "text", nullable: true),
                    content = table.Column<byte[]>(type: "bytea", nullable: false),
                    extension = table.Column<string>(type: "text", nullable: false),
                    userid = table.Column<string>(name: "user_id", type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_profile_files", x => x.fileid);
                });

            migrationBuilder.CreateTable(
                name: "typing_statuses",
                columns: table => new
                {
                    UserId = table.Column<string>(type: "text", nullable: false),
                    GuildId = table.Column<string>(type: "text", nullable: false),
                    ChannelId = table.Column<string>(type: "text", nullable: false),
                    Timestamp = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_typing_statuses", x => new { x.UserId, x.GuildId, x.ChannelId });
                });

            migrationBuilder.CreateTable(
                name: "users",
                columns: table => new
                {
                    userid = table.Column<string>(name: "user_id", type: "text", nullable: false),
                    email = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    discriminator = table.Column<string>(type: "character varying(4)", maxLength: 4, nullable: false),
                    password = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    nickname = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    bot = table.Column<int>(type: "integer", nullable: false),
                    status = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    description = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    createdat = table.Column<DateTime>(name: "created_at", type: "timestamp with time zone", nullable: false),
                    lastlogin = table.Column<DateTime>(name: "last_login", type: "timestamp with time zone", nullable: true),
                    dateofbirth = table.Column<DateTime>(name: "date_of_birth", type: "timestamp with time zone", nullable: true),
                    verified = table.Column<int>(type: "integer", nullable: false),
                    location = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    language = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    phonenumber = table.Column<string>(name: "phone_number", type: "character varying(15)", maxLength: 15, nullable: true),
                    socialmedialinks = table.Column<string>(name: "social_media_links", type: "character varying(512)", maxLength: 512, nullable: true),
                    preferences = table.Column<JsonElement>(type: "jsonb", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_users", x => x.userid);
                });

            migrationBuilder.CreateTable(
                name: "channels",
                columns: table => new
                {
                    channelid = table.Column<string>(name: "channel_id", type: "text", nullable: false),
                    channelname = table.Column<string>(name: "channel_name", type: "text", nullable: false),
                    channeldescription = table.Column<string>(name: "channel_description", type: "text", nullable: true),
                    istextchannel = table.Column<bool>(name: "is_text_channel", type: "boolean", nullable: false),
                    lastreaddatetime = table.Column<DateTime>(name: "last_read_datetime", type: "timestamp with time zone", nullable: true),
                    guildid = table.Column<string>(name: "guild_id", type: "text", nullable: false),
                    order = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_channels", x => x.channelid);
                    table.ForeignKey(
                        name: "FK_channels_guilds_guild_id",
                        column: x => x.guildid,
                        principalTable: "guilds",
                        principalColumn: "guild_id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "guild_permissions",
                columns: table => new
                {
                    guildid = table.Column<string>(name: "guild_id", type: "text", nullable: false),
                    userid = table.Column<string>(name: "user_id", type: "text", nullable: false),
                    ReadMessages = table.Column<int>(type: "integer", nullable: false),
                    SendMessages = table.Column<int>(type: "integer", nullable: false),
                    ManageRoles = table.Column<int>(type: "integer", nullable: false),
                    KickMembers = table.Column<int>(type: "integer", nullable: false),
                    BanMembers = table.Column<int>(type: "integer", nullable: false),
                    ManageChannels = table.Column<int>(type: "integer", nullable: false),
                    MentionEveryone = table.Column<int>(type: "integer", nullable: false),
                    AddReaction = table.Column<int>(type: "integer", nullable: false),
                    IsAdmin = table.Column<int>(type: "integer", nullable: false),
                    CanInvite = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_guild_permissions", x => new { x.guildid, x.userid });
                    table.ForeignKey(
                        name: "FK_guild_permissions_guilds_guild_id",
                        column: x => x.guildid,
                        principalTable: "guilds",
                        principalColumn: "guild_id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_guild_permissions_users_user_id",
                        column: x => x.userid,
                        principalTable: "users",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "guild_users",
                columns: table => new
                {
                    guildid = table.Column<string>(name: "guild_id", type: "text", nullable: false),
                    userid = table.Column<string>(name: "user_id", type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_guild_users", x => new { x.guildid, x.userid });
                    table.ForeignKey(
                        name: "FK_guild_users_guilds_guild_id",
                        column: x => x.guildid,
                        principalTable: "guilds",
                        principalColumn: "guild_id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_guild_users_users_user_id",
                        column: x => x.userid,
                        principalTable: "users",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "user_dms",
                columns: table => new
                {
                    userid = table.Column<string>(name: "user_id", type: "text", nullable: false),
                    friendid = table.Column<string>(name: "friend_id", type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_user_dms", x => new { x.userid, x.friendid });
                    table.ForeignKey(
                        name: "FK_user_dms_users_friend_id",
                        column: x => x.friendid,
                        principalTable: "users",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_user_dms_users_user_id",
                        column: x => x.userid,
                        principalTable: "users",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "user_channels",
                columns: table => new
                {
                    UserId = table.Column<string>(type: "text", nullable: false),
                    ChannelId = table.Column<string>(type: "text", nullable: false),
                    LastReadDatetime = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_user_channels", x => new { x.UserId, x.ChannelId });
                    table.ForeignKey(
                        name: "FK_user_channels_channels_ChannelId",
                        column: x => x.ChannelId,
                        principalTable: "channels",
                        principalColumn: "channel_id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_user_channels_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_channels_guild_id",
                table: "channels",
                column: "guild_id");

            migrationBuilder.CreateIndex(
                name: "IX_discriminators_nickname_value",
                table: "discriminators",
                columns: new[] { "nickname", "value" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_guild_permissions_user_id",
                table: "guild_permissions",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "IX_guild_users_user_id",
                table: "guild_users",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "IX_user_channels_ChannelId",
                table: "user_channels",
                column: "ChannelId");

            migrationBuilder.CreateIndex(
                name: "IX_user_dms_friend_id",
                table: "user_dms",
                column: "friend_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "attachment_files");

            migrationBuilder.DropTable(
                name: "discriminators");

            migrationBuilder.DropTable(
                name: "emoji_files");

            migrationBuilder.DropTable(
                name: "friends");

            migrationBuilder.DropTable(
                name: "guild_permissions");

            migrationBuilder.DropTable(
                name: "guild_users");

            migrationBuilder.DropTable(
                name: "guilds_files");

            migrationBuilder.DropTable(
                name: "Message");

            migrationBuilder.DropTable(
                name: "profile_files");

            migrationBuilder.DropTable(
                name: "typing_statuses");

            migrationBuilder.DropTable(
                name: "user_channels");

            migrationBuilder.DropTable(
                name: "user_dms");

            migrationBuilder.DropTable(
                name: "channels");

            migrationBuilder.DropTable(
                name: "users");

            migrationBuilder.DropTable(
                name: "guilds");
        }
    }
}