// @flow

import React from "react";

export default class ExternalRedirect extends React.Component<{|
  +redirectTo: string,
|}> {
  render() {
    return (
      <React.Fragment>
        <h1>Redirecting…</h1>
        <p>
          Redirecting to:{" "}
          <a href={this.props.redirectTo}>{this.props.redirectTo}</a>
        </p>
      </React.Fragment>
    );
  }

  componentDidMount() {
    // The server-rendered copy of this page will have a meta-refresh
    // tag, but someone could still plausibly navigate to this page with
    // the client-side renderer. In that case, we should redirect them.
    window.location.href = this.props.redirectTo;
  }
}
