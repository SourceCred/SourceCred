// @flow
// Implementation of `sourcecred help`.

import type {Command} from "./command";
import {goHelp} from "./go";
import {grainHelp} from "./grain";
import dedent from "../util/dedent";

const help: Command = async (args, std) => {
  if (args.length === 0) {
    usage(std.out);
    return 0;
  }
  const command = args[0];
  const subHelps: {[string]: Command} = {
    help: metaHelp,
    go: goHelp,
    grain: grainHelp,
  };
  if (subHelps[command] !== undefined) {
    return subHelps[command](args.slice(1), std);
  } else {
    usage(std.err);
    return 1;
  }
};

function usage(print: (string) => void): void {
  // TODO: Make the usage function pull its list of commands
  // from the sub-helps, to ensure that it is comprehensive
  print(
    dedent`\
    usage: sourcecred COMMAND [ARGS...]
           sourcecred [--version] [--help]

    Commands:
      
      MAIN
      go            load plugin data and generate cred scores
      serve         serve admin site locally to update Ledger and Identities
      grain         calculate and record grain distribution(s) in the ledger

      AUXIlIARY
      load          load plugin data into cache
      graph         build Cred graph from cached plugin data
      score         generate Cred Scores from from graph
      site          update your cred site with the latest changes

      help          show this help message

    Use 'sourcecred help COMMAND' for help about an individual command.
    `.trimRight()
  );
}

const metaHelp: Command = async (args, std) => {
  if (args.length === 0) {
    std.out(
      dedent`\
      usage: sourcecred help [COMMAND]

      Use 'sourcecred help' for general help and a list of commands.
      Use 'sourcecred help COMMAND' for help about COMMAND.
      `.trimRight()
    );
    return 0;
  } else {
    usage(std.err);
    return 1;
  }
};

export default help;
