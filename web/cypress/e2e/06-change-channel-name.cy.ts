describe("Change Channel Name", () => {
    before(() => {
        cy.login();
        cy.visit(Cypress.env("frontendUrl"));
    });
  
    it("Changes channel name", () => {
        cy.clickFirstGuild();
        cy.url().then((url) => {
            const id = url.split('/')[5]; // Channel id
  
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
            cy.intercept("POST", "**/api/guilds/*/channels/*").as("channelChangeRequest");
  
            cy.get("#settings-unsaved-popup-applybutton").click();
            cy.wait("@channelChangeRequest").its("response.statusCode").should("eq", 200);
            cy.get("#close-settings-button").click();
            cy.wait(300);
            cy.get("#channel-container")
            .find("#channelul").children().eq(1)
                .find(".channelSpan")
                .should("have.text", testChannel)
                .and(($el) => {
                    const text = $el.text().trim();
                    expect(text.indexOf(testChannel)).to.equal(0);
            });
        });
    });
  });
  