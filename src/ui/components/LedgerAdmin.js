// @flow

import React, {useState, useMemo, type Node as ReactNode} from "react";
import {makeStyles} from "@material-ui/core/styles";
import ButtonGroup from "@material-ui/core/ButtonGroup";
import {
  Button,
  Checkbox,
  Container,
  FormControlLabel,
  List,
  TextField,
} from "@material-ui/core";
import {useLedger} from "../utils/LedgerContext";
import {useTableState} from "../../webutil/tableState";
import {IdentityMerger} from "./IdentityMerger";
import {type Identity, type IdentityId} from "../../core/identity";
import {AliasView} from "./AliasView";
import {IdentityListItems} from "./IdentityListItems";

const useStyles = makeStyles((theme) => {
  return {
    root: {
      color: theme.palette.text.primary,
      width: "100%",
      maxWidth: "50em",
      padding: "0 5em 5em",
    },
    identityList: {
      backgroundColor: theme.palette.background.paper,
      width: "100%",
      marginTop: theme.spacing(3),
      overflow: "auto",
      maxHeight: 500,
    },
    centerRow: {
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
    },
    spreadRow: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      margin: theme.spacing(6, 0, 0, 0),
    },
    updateElement: {
      flexGrow: 2,
      flexBasis: theme.spacing(5),
      margin: theme.spacing(3, 0),
    },
    filterBox: {
      flexGrow: 1,
      maxWidth: "15rem",
    },
    checkboxElement: {flexGrow: 1, flexBasis: 0, margin: theme.spacing(3)},
    IdentitiesHeader: {margin: theme.spacing(3, 0)},
    backButton: {
      marginLeft: theme.spacing(2),
    },
    addEditPrompt: {
      margin: 0,
    },
  };
});

export const LedgerAdmin = (): ReactNode => {
  const {ledger, updateLedger, saveToDisk} = useLedger();

  const classes = useStyles();
  const [nextIdentityName, setIdentityName] = useState<string>("");
  const [selectedId, setSelectedId] = useState<IdentityId | null>(null);
  const [promptString, setPromptString] = useState<string>("Add Identity:");
  const [checkboxSelected, setCheckBoxSelected] = useState<boolean>(false);
  const accounts = useMemo(() => ledger.accounts().map((a) => a.identity), [
    ledger._latestTimestamp,
  ]);
  const accountsTableState = useTableState({data: accounts});

  const changeIdentityName = (event: SyntheticInputEvent<HTMLInputElement>) =>
    setIdentityName(event.currentTarget.value);

  const createOrUpdateIdentity = () => {
    if (!selectedId) {
      const newID = ledger.createIdentity("USER", nextIdentityName);
      setActiveIdentity(ledger.account(newID).identity);
    } else {
      ledger.renameIdentity(selectedId, nextIdentityName);
    }
    updateLedger(ledger);
  };

  const toggleIdentityActivation = (id: IdentityId) => {
    let nextLedger;
    if (ledger.account(id).active) {
      nextLedger = ledger.deactivate(id);
      setCheckBoxSelected(false);
    } else {
      nextLedger = ledger.activate(id);
      setCheckBoxSelected(true);
    }
    updateLedger(nextLedger);
  };

  const resetIdentity = () => {
    setIdentityName("");
    setSelectedId(null);
    setCheckBoxSelected(false);
    setPromptString("Add Identity: ");
  };

  const setActiveIdentity = (identity: Identity) => {
    setIdentityName(identity.name);
    setSelectedId(identity.id);
    setCheckBoxSelected(ledger.account(identity.id).active);
    setPromptString("Update Identity: ");
  };

  const filterIdentities = (event: SyntheticInputEvent<HTMLInputElement>) => {
    // fuzzy match letters "in order, but not necessarily sequentially", per issue #2490
    const filterString = event.target.value
      .trim()
      .toLowerCase()
      .split("")
      .join("+.*");
    const regex = new RegExp(filterString);

    accountsTableState.createOrUpdateFilterFn("filterIdentities", (identity) =>
      regex.test(identity.name.toLowerCase())
    );
  };

  return (
    <Container className={classes.root}>
      <span className={classes.centerRow}>
        <h1 className={classes.IdentitiesHeader}>Identities</h1>
      </span>
      <h3 className={classes.addEditPrompt}>{promptString}</h3>
      <div className={classes.centerRow}>
        <TextField
          fullWidth
          className={classes.updateElement}
          variant="outlined"
          type="text"
          onChange={changeIdentityName}
          value={nextIdentityName}
          label={"Name"}
        />
        {selectedId && (
          <FormControlLabel
            fullWidth
            className={classes.checkboxElement}
            control={
              <Checkbox
                checked={checkboxSelected}
                onChange={() => toggleIdentityActivation(selectedId)}
                name="active"
                color="primary"
              />
            }
            label="Account is active"
          />
        )}
      </div>
      <ButtonGroup color="primary" variant="contained">
        <Button
          onClick={createOrUpdateIdentity}
          disabled={nextIdentityName.trim().length === 0}
        >
          {selectedId ? "update username" : "create identity"}
        </Button>
        <Button onClick={saveToDisk}>save ledger to disk</Button>
        {selectedId && <Button onClick={resetIdentity}>New identity</Button>}
      </ButtonGroup>
      {selectedId && (
        <Button onClick={resetIdentity} className={classes.backButton}>
          Back
        </Button>
      )}
      {selectedId && (
        <>
          <AliasView selectedId={selectedId} />
          <IdentityMerger selectedId={selectedId} />
        </>
      )}{" "}
      <div className={classes.spreadRow}>
        <h3>
          Identities{" "}
          {accountsTableState.length > 0 && (
            <small> (click one to update it)</small>
          )}
        </h3>
        <TextField
          className={classes.filterBox}
          variant="outlined"
          type="text"
          onChange={filterIdentities}
          label={"Filter list..."}
        />
      </div>
      <div className={classes.centerRow}>
        <List fullWidth className={classes.identityList}>
          <IdentityListItems
            identities={accountsTableState.currentPage}
            onClick={(identity) => setActiveIdentity(identity)}
          />
        </List>
      </div>
    </Container>
  );
};
