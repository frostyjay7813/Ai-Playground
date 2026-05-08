const { Head, Html, Main, NextScript } = require("next/document");
const React = require("react");

function Document() {
  return React.createElement(
    Html,
    { lang: "en" },
    React.createElement(Head, null),
    React.createElement(
      "body",
      null,
      React.createElement(Main, null),
      React.createElement(NextScript, null)
    )
  );
}

module.exports = Document;
