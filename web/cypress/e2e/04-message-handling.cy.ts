describe("Create, edit and delete message", () => {
  before(() => {
    cy.login();
    cy.visit(Cypress.env("frontendUrl"));
  });

  it("Create, edit and delete message", () => {
    cy.clickFirstGuild();

    // check for messages
    // click every message if found any
    cy.get("#chat-content").then(($chat) => {
      const $messages = $chat.children(".message");
      if ($messages.length === 0) {
        cy.log("No messages to delete");
        return;
      }

      cy.wrap($messages).each(($el) => {
        cy.wrap($el)
          .trigger("mouseover", { force: true })
          .find(".message-button-container")
          .should("be.visible")
          .find(".message-button")
          .click({ force: true });

        cy.get("#contextMenu").children().contains("Delete Message").click();
        cy.get(".pop-up-accept").click();
      });
    });

    // create message
    cy.get("#user-input").type("Hello world");
    cy.intercept("POST", `**/api/guilds/**/channels/**/messages`).as(
      "sendMessageRequest"
    );
    cy.get("#user-input").type("{enter}");

    cy.wait("@sendMessageRequest").its("response.statusCode").should("eq", 200);

    // edit message

    cy.get("#chat-content")
      .children(".message")
      .first()
      .trigger("mouseover", { force: true })
      .find(".message-button-container")
      .should("be.visible")
      .find(".message-button")
      .click({ force: true });

    cy.get("#contextMenu").children().contains("Edit Message").click();

    const editedMessage = "Lorem ipsum";
    cy.get("#chat-content")
      .children(".message")
      .first()
      .children("#message-content-element")
      .children(".edit-message-div.base-user-input")
      .clear();

    cy.get("#chat-content")
      .children(".message")
      .first()
      .children("#message-content-element")
      .children(".edit-message-div.base-user-input")
      .type(editedMessage);
    cy.intercept("PUT", `**/api/guilds/**/channels/**/messages/**`).as(
      "editMessageRequest"
    );

    cy.get("#chat-content")
      .children(".message")
      .first()
      .children("#message-content-element")
      .children(".edit-message-div.base-user-input")
      .type("{enter}");

    cy.wait("@editMessageRequest").its("response.statusCode").should("eq", 200);
    cy.get("#chat-content")
      .children(".message")
      .first()
      .find("#message-content-element")
      .then(($el) => {
        const el = $el[0];
        const directText = Array.from(el.childNodes)
          .filter((node) => node.nodeType === 3)
          .map((node) => node.textContent.trim())
          .join("");

        expect(directText).to.equal(editedMessage);
      });

    cy.get("#chat-content")
      .children(".message")
      .first()
      .trigger("mouseover", { force: true })
      .find(".message-button-container")
      .should("be.visible")
      .find(".message-button")
      .click({ force: true });

    cy.intercept("DELETE", `**/api/guilds/**/channels/**/messages/**`).as(
      "deleteMessageRequest"
    );
    cy.get("#contextMenu").children().contains("Delete Message").click();
    cy.get(".pop-up-accept").click();
    cy.wait("@deleteMessageRequest")
      .its("response.statusCode")
      .should("eq", 200);
  });
});
