describe("Create Guild", () => {
  before(() => {
    cy.login();
    cy.visit(Cypress.env("frontendUrl"));
  });
  it("Creates guild", () => {
    cy.get("#create-guild-button").click();
    cy.get("#popOptionButton").click();
    cy.get("#guild-name-input").clear();
    cy.get("#guild-name-input").type("Test Guild");

    cy.intercept("POST", "**/api/guilds").as("guildCreateRequest");

    cy.get(".create-guild-verify").click();

    cy.wait("@guildCreateRequest").its("response.statusCode").should("eq", 201);
  });
});

describe("Change Guild Name Test", () => {
  before(() => {
    cy.login();
    cy.visit(Cypress.env("frontendUrl"));
  });
  it("Change guild name and apply settings", () => {
    cy.clickFirstGuild();
    cy.get("#guild-container").click();
    cy.get("#settings-dropdown-button").click();

    const testGuild = "TestGuild-" + Date.now();
    cy.get("#guild-overview-name-input").clear();
    cy.get("#guild-overview-name-input").type(testGuild);
    cy.url().then((url) => {
      const id = url.split("/")[4]; // Guild Id

      cy.intercept("PUT", `**/api/guilds/${id}`).as("changeGuildNameRequest");

      cy.get("#settings-unsaved-popup-applybutton").click();
      cy.wait("@changeGuildNameRequest")
        .its("response.statusCode")
        .should("eq", 200);
      cy.get("#guild-name").should("have.text", testGuild);
    });
  });
});
describe("Create Channel", () => {
  before(() => {
    cy.login();
    cy.visit(Cypress.env("frontendUrl"));
  });

  it("Creates channel", () => {
    cy.clickFirstGuild();
    cy.get("#guild-container").click();
    cy.get("#channel-container")
      .find("#channelul")
      .children()
      .as("initialChannelCount");
    cy.get("#channel-dropdown-button").click();
    cy.get("#create-channel-send-input").type("Test channel");

    // Check if channel count is increased after request
    cy.get("@initialChannelCount").then((initialCount) => {
      cy.intercept("POST", "**/api/guilds/*/channels").as(
        "channelCreateRequest"
      );
      cy.get(".pop-up-accept").click();
      cy.wait("@channelCreateRequest")
        .its("response.statusCode")
        .should("eq", 200);
      cy.get("#channel-container")
        .find("#channelul")
        .children()
        .should("have.length.greaterThan", initialCount.length);
    });
  });
});

describe("Change Channel Name", () => {
  before(() => {
    cy.login();
    cy.visit(Cypress.env("frontendUrl"));
  });

  it("Changes channel name", () => {
    cy.clickFirstGuild();
    cy.url().then((url) => {
      const id = url.split("/")[5]; // Channel id

      cy.get("#channel-container")
        .find("#channelul")
        .children()
        .eq(1)
        .trigger("mouseover")
        .find(".content-wrapper")
        .click();

      cy.get("#channel-overview-name-input").clear();
      const testChannel = "TestChannel-" + Date.now();
      cy.get("#channel-overview-name-input").type(testChannel);
      cy.intercept("POST", "**/api/guilds/*/channels/*").as(
        "channelChangeRequest"
      );

      cy.get("#settings-unsaved-popup-applybutton").click();
      cy.wait("@channelChangeRequest")
        .its("response.statusCode")
        .should("eq", 200);
      cy.get("#close-settings-button").click();
      cy.wait(300);
      cy.get("#channel-container")
        .find("#channelul")
        .children()
        .eq(1)
        .find(".channelSpan")
        .should("have.text", testChannel)
        .and(($el) => {
          const text = $el.text().trim();
          expect(text.indexOf(testChannel)).to.equal(0);
        });
    });
  });
});

describe("Delete Channel", () => {
  before(() => {
    cy.login();
    cy.visit(Cypress.env("frontendUrl"));
  });

  it("Deletes channel", () => {
    cy.clickFirstGuild();
    cy.intercept("DELETE", "**/api/guilds/*/channels/*").as(
      "channelDeleteRequest"
    );

    cy.get("#channel-container")
      .find("#channelul")
      .children()
      .eq(1)
      .trigger("mouseover")
      .find(".content-wrapper")
      .click();

    cy.get("#settings-leftbar")
      .first()
      .find(".settings-buttons")
      .last()
      .click();

    cy.get(".pop-up-accept").click();

    cy.wait("@channelDeleteRequest")
      .its("response.statusCode")
      .should("eq", 200);
  });
});

