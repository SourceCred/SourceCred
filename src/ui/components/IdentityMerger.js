// @flow
import type {Node} from "React";import React, {useState, useEffect} from "react";
import {useLedger} from "../utils/LedgerContext";
import {type IdentityId, type Identity} from "../../ledger/identity";

import {makeStyles} from "@material-ui/core/styles";
import {TextField} from "@material-ui/core";
import {Autocomplete} from "@material-ui/lab";

type Props = {|
  +selectedId: IdentityId,
|};

const useStyles = makeStyles({
  element: {margin: "20px"},
  aliasesHeader: {margin: "20px", marginBottom: 0},
});

export function IdentityMerger({selectedId}: Props): Node {
  const {ledger, updateLedger} = useLedger();
  const classes = useStyles();
  const [inputValue, setInputValue] = useState("");

  const potentialIdentities = ledger
    .accounts()
    .map((a) => a.identity)
    .filter((i) => i.id !== selectedId);

  const identitiesMatchingSearch = (input: string): Identity[] =>
    potentialIdentities.filter(({name}) =>
      name.toLowerCase().includes(input.toLowerCase())
    );

  const [inputItems, setInputItems] = useState(identitiesMatchingSearch(""));

  const setSearch = (input: string = "") =>
    setInputItems(identitiesMatchingSearch(input));

  useEffect(() => setSearch(), [selectedId]);

  return (
    <>
      <Autocomplete
        onInputChange={(_, value, reason) => {
          if (reason === "input") {
            setSearch(value);
            setInputValue(value);
          }
        }}
        onChange={(_, selectedItem, reason) => {
          if (reason === "select-option") {
            updateLedger(
              ledger.mergeIdentities({
                base: selectedId,
                target: selectedItem.id,
              })
            );
            setSearch("");
            setInputValue("");
          }
        }}
        className={classes.element}
        freeSolo
        disableClearable
        options={inputItems}
        getOptionLabel={({name}) => name || ""}
        inputValue={inputValue}
        renderInput={(params) => (
          <TextField {...params} variant="outlined" label="Identity" />
        )}
      />
    </>
  );
}
