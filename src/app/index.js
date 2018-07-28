// @flow
import React from "react";
import ReactDOM from "react-dom";
import "./style/index.css";
import App from "./App";
import {unregister} from "./registerServiceWorker";

const root = document.getElementById("root");
if (root == null) {
  throw new Error("Unable to find root element!");
}
ReactDOM.render(<App />, root);
unregister();
