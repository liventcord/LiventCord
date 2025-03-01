"use strict";(self.webpackChunklivent_cord_docs=self.webpackChunklivent_cord_docs||[]).push([[727],{905:(e,n,t)=>{t.r(n),t.d(n,{contentTitle:()=>i,default:()=>m,frontMatter:()=>o,metadata:()=>p,toc:()=>l});var a=t(8168),r=(t(6540),t(5680));const o={sidebar_position:1},i="Set Enviroment Variables",p={unversionedId:"tutorial-basics/set-enviroment-variables",id:"tutorial-basics/set-enviroment-variables",isDocsHomePage:!1,title:"Set Enviroment Variables",description:".NET Server Configuration",source:"@site/docs/tutorial-basics/set-enviroment-variables.md",sourceDirName:"tutorial-basics",slug:"/tutorial-basics/set-enviroment-variables",permalink:"/LiventCord/tutorial-basics/set-enviroment-variables",editUrl:"https://github.com/LiventCord/liventcord/edit/main/docs/docs/tutorial-basics/set-enviroment-variables.md",tags:[],version:"current",sidebarPosition:1,frontMatter:{sidebar_position:1},sidebar:"tutorialSidebar",previous:{title:"Tutorial Intro",permalink:"/LiventCord/"},next:{title:"Docker Quick Start",permalink:"/LiventCord/docker"}},l=[{value:".NET Server Configuration",id:"net-server-configuration",children:[]},{value:"Gin Server Configuration",id:"gin-server-configuration",children:[]}],s={toc:l},g="wrapper";function m(e){let{components:n,...t}=e;return(0,r.yg)(g,(0,a.A)({},s,t,{components:n,mdxType:"MDXLayout"}),(0,r.yg)("h1",{id:"set-enviroment-variables"},"Set Enviroment Variables"),(0,r.yg)("h2",{id:"net-server-configuration"},".NET Server Configuration"),(0,r.yg)("ol",null,(0,r.yg)("li",{parentName:"ol"},"Move ",(0,r.yg)("inlineCode",{parentName:"li"},"Properties/exampleSettings.json")," to ",(0,r.yg)("inlineCode",{parentName:"li"},"Properties/appsettings.json"),".")),(0,r.yg)("pre",null,(0,r.yg)("code",{parentName:"pre",className:"language-bash"},"mv Properties/exampleSettings.json Properties/appsettings.json\n")),(0,r.yg)("h4",{id:"configuration-options"},"Configuration Options"),(0,r.yg)("ul",null,(0,r.yg)("li",{parentName:"ul"},(0,r.yg)("p",{parentName:"li"},(0,r.yg)("strong",{parentName:"p"},"Host"),":\nHostname the server will run at.\n",(0,r.yg)("strong",{parentName:"p"},"Defaults to")," ",(0,r.yg)("inlineCode",{parentName:"p"},"0.0.0.0"))),(0,r.yg)("li",{parentName:"ul"},(0,r.yg)("p",{parentName:"li"},(0,r.yg)("strong",{parentName:"p"},"Port"),":\nPort the server will run at.\n",(0,r.yg)("strong",{parentName:"p"},"Defaults to")," ",(0,r.yg)("inlineCode",{parentName:"p"},"5005"))),(0,r.yg)("li",{parentName:"ul"},(0,r.yg)("p",{parentName:"li"},(0,r.yg)("strong",{parentName:"p"},"RemoteConnection"),":\nConnection string for the database.")),(0,r.yg)("li",{parentName:"ul"},(0,r.yg)("p",{parentName:"li"},(0,r.yg)("strong",{parentName:"p"},"DatabaseType"),":\nType of database server for data storage. Supported options:"),(0,r.yg)("pre",{parentName:"li"},(0,r.yg)("code",{parentName:"pre"},"- **PostgreSQL**\n- **MySQL**\n- **MariaDB**\n- **Oracle**\n- **Firebird**\n- **SqlServer**\n- **SQLite**\n")),(0,r.yg)("p",{parentName:"li"},"  Defaults to ",(0,r.yg)("inlineCode",{parentName:"p"},"sqlite")),(0,r.yg)("p",{parentName:"li"},"-",(0,r.yg)("strong",{parentName:"p"},"MaxPoolSize"),":\nMaximum number of connections in the database pool.\n",(0,r.yg)("strong",{parentName:"p"},"Defaults to")," ",(0,r.yg)("inlineCode",{parentName:"p"},"5")),(0,r.yg)("p",{parentName:"li"},"-",(0,r.yg)("strong",{parentName:"p"},"MinPoolSize"),":\nMinimum number of connections in the database pool.\n",(0,r.yg)("strong",{parentName:"p"},"Defaults to")," ",(0,r.yg)("inlineCode",{parentName:"p"},"0"))),(0,r.yg)("li",{parentName:"ul"},(0,r.yg)("p",{parentName:"li"},(0,r.yg)("strong",{parentName:"p"},"SqlitePath"),":\nFile path where SQLite will store data.\n",(0,r.yg)("strong",{parentName:"p"},"Defaults to")," ",(0,r.yg)("inlineCode",{parentName:"p"},"Data/liventcord.db"))),(0,r.yg)("li",{parentName:"ul"},(0,r.yg)("p",{parentName:"li"},(0,r.yg)("strong",{parentName:"p"},"FrontendUrl"),":\nUrl to add cors headers at.\n",(0,r.yg)("strong",{parentName:"p"},"Defaults to")," ",(0,r.yg)("inlineCode",{parentName:"p"},"none"))),(0,r.yg)("li",{parentName:"ul"},(0,r.yg)("p",{parentName:"li"},(0,r.yg)("strong",{parentName:"p"},"GifWorkerUrl"),":\nURL of the Cloudflare Worker for querying Tenor GIFs.\n",(0,r.yg)("strong",{parentName:"p"},"Defaults to")," ",(0,r.yg)("inlineCode",{parentName:"p"},'"gif-worker.liventcord-a60.workers.dev"'))),(0,r.yg)("li",{parentName:"ul"},(0,r.yg)("p",{parentName:"li"},(0,r.yg)("strong",{parentName:"p"},"ProxyWorkerUrl"),":\nUrl of the Cloudflare Worker for proxying external resources.\n",(0,r.yg)("strong",{parentName:"p"},"Defaults to")," ",(0,r.yg)("inlineCode",{parentName:"p"},'"proxy.liventcord-a60.workers.dev"'))),(0,r.yg)("li",{parentName:"ul"},(0,r.yg)("p",{parentName:"li"},(0,r.yg)("strong",{parentName:"p"},"MaxAvatarSize"),":\nMaximum upload size(in MB) for avatar on guilds and profiles.\n",(0,r.yg)("strong",{parentName:"p"},"Defaults to")," ",(0,r.yg)("inlineCode",{parentName:"p"},"3"))),(0,r.yg)("li",{parentName:"ul"},(0,r.yg)("p",{parentName:"li"},(0,r.yg)("strong",{parentName:"p"},"MaxAttachmentsSize"),":\nMaximum attachment size (in MB) allowed for message uploads.\n",(0,r.yg)("strong",{parentName:"p"},"Defaults to")," ",(0,r.yg)("inlineCode",{parentName:"p"},"30"))),(0,r.yg)("li",{parentName:"ul"},(0,r.yg)("p",{parentName:"li"},(0,r.yg)("strong",{parentName:"p"},"BotToken"),":\nA token used to secure the discord importer bot endpoints for admin access.\n",(0,r.yg)("strong",{parentName:"p"},"Defaults to")," ",(0,r.yg)("inlineCode",{parentName:"p"},"random generated number"))),(0,r.yg)("li",{parentName:"ul"},(0,r.yg)("p",{parentName:"li"},(0,r.yg)("strong",{parentName:"p"},"EnableMetadataIndexing"),":\nIndex urls in message content for metadata display.\n",(0,r.yg)("strong",{parentName:"p"},"Defaults to")," ",(0,r.yg)("inlineCode",{parentName:"p"},"true"))),(0,r.yg)("li",{parentName:"ul"},(0,r.yg)("p",{parentName:"li"},(0,r.yg)("strong",{parentName:"p"},"MetadataDomainLimit"),":\nThe maximum number of metadata records that can be indexed or stored per domain within a day.\n",(0,r.yg)("strong",{parentName:"p"},"Defaults to")," ",(0,r.yg)("inlineCode",{parentName:"p"},"100"))),(0,r.yg)("li",{parentName:"ul"},(0,r.yg)("p",{parentName:"li"},(0,r.yg)("strong",{parentName:"p"},"MediaProxy"),":\nProxy adress for media previews.\n",(0,r.yg)("strong",{parentName:"p"},"Defaults to")," ",(0,r.yg)("inlineCode",{parentName:"p"},"none"))),(0,r.yg)("li",{parentName:"ul"},(0,r.yg)("p",{parentName:"li"},(0,r.yg)("strong",{parentName:"p"},"ExternalMediaLimit"),":\nSize limit(in GB) for total media storage on proxying external resources. If limit is reached, oldest records will be replaced with new files.\n",(0,r.yg)("strong",{parentName:"p"},"Defaults to")," ",(0,r.yg)("inlineCode",{parentName:"p"},"10"))),(0,r.yg)("li",{parentName:"ul"},(0,r.yg)("p",{parentName:"li"},(0,r.yg)("strong",{parentName:"p"},"BuildFrontend"),":\nWhether to build frontend assets on .net server start or not.\n",(0,r.yg)("strong",{parentName:"p"},"Defaults to")," ",(0,r.yg)("inlineCode",{parentName:"p"},"none")))),(0,r.yg)("h2",{id:"gin-server-configuration"},"Gin Server Configuration"),(0,r.yg)("ol",null,(0,r.yg)("li",{parentName:"ol"},"Move .example.env to .env.")),(0,r.yg)("pre",null,(0,r.yg)("code",{parentName:"pre",className:"language-bash"},"mv .example.env .env\n")),(0,r.yg)("h4",{id:"configuration-options-1"},"Configuration Options"),(0,r.yg)("ul",null,(0,r.yg)("li",{parentName:"ul"},(0,r.yg)("p",{parentName:"li"},(0,r.yg)("strong",{parentName:"p"},"Host"),":\nHostname the server will run at.\n",(0,r.yg)("strong",{parentName:"p"},"Defaults to")," ",(0,r.yg)("inlineCode",{parentName:"p"},"0.0.0.0"))),(0,r.yg)("li",{parentName:"ul"},(0,r.yg)("p",{parentName:"li"},(0,r.yg)("strong",{parentName:"p"},"Port"),":\nPort the server will run at.\n",(0,r.yg)("strong",{parentName:"p"},"Defaults to")," ",(0,r.yg)("inlineCode",{parentName:"p"},"8080"))),(0,r.yg)("li",{parentName:"ul"},(0,r.yg)("p",{parentName:"li"},(0,r.yg)("strong",{parentName:"p"},"DotnetApiUrl"),":\nThe URL used to verify the WebSocket authentication by passing the cookie to the .NET server.\n",(0,r.yg)("strong",{parentName:"p"},"Defaults to")," ",(0,r.yg)("inlineCode",{parentName:"p"},"http://localhost:5005")),(0,r.yg)("p",{parentName:"li"},"-",(0,r.yg)("strong",{parentName:"p"},"RedisConnectionString"),":\nConnection string for connecting redis\n",(0,r.yg)("strong",{parentName:"p"},"Defaults to")," ",(0,r.yg)("inlineCode",{parentName:"p"},"localhost:6379")))))}m.isMDXComponent=!0}}]);