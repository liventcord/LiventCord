import discord


async def handle_ui(message: discord.Message) -> None:
    mention = message.mentions[0] if message.mentions else None
    if not mention or not message.guild:
        return

    user = mention
    user_name = user.name
    user_id = user.id
    user_created_at = user.created_at.strftime("%Y-%m-%d") if user.created_at else "N/A"
    user_is_bot = "🟢" if user.bot else "🔴"

    member = (
        message.guild.get_member(user.id) if isinstance(user, discord.Member) else None
    )
    if isinstance(member, discord.Member):
        user_status = "🟢" if str(member.status) == "online" else "🔴"
    else:
        user_status = "N/A"
    nickname = member.nick if member and member.nick else user_name
    join_date = (
        member.joined_at.strftime("%Y-%m-%d") if member and member.joined_at else "N/A"
    )
    roles = (
        [role.name for role in member.roles if role.name != "@everyone"]
        if member
        else []
    )
    highest_role = roles[-1] if roles else "None"
    lowest_role = roles[0] if roles else "None"
    admin_status = "🟢" if member and member.guild_permissions.administrator else "🔴"

    roles_text = ", ".join(roles) if roles else "None"

    embed = discord.Embed(
        title=f"{user_name} isimli kullanıcının profili", color=0x00FF00
    )

    embed.add_field(
        name="KULLANICI",
        value=(
            f"📝 **Kullanıcı Adı:** {user_name}\n"
            f"🆔 **Kullanıcı ID:** {user_id}\n"
            f"📅 **Oluşturma Tarihi:** {user_created_at}\n"
            f"🤖 **Bot:** {user_is_bot}\n"
            f"👤 **Durum:** {user_status}\n"
        ),
        inline=False,
    )

    embed.add_field(
        name="SUNUCU",
        value=(
            f"📝 **Takma Ad:** {nickname}\n"
            f"🗓 **Katılma Tarihi:** {join_date}\n"
            f"🎭 **Roller:** {roles_text}\n"
            f"🔼 **En Yüksek Rol:** {highest_role}\n"
            f"🔽 **En Düşük Rol:** {lowest_role}\n"
            f"🛠️ **Admin:** {admin_status}"
        ),
        inline=False,
    )
    await message.channel.send(embed=embed)
