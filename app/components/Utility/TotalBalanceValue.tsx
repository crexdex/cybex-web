import * as React from "react";
import * as PropTypes from "prop-types";

import FormattedAsset from "./FormattedAsset";
import ChainTypes from "./ChainTypes";
import BindToChainState from "./BindToChainState";
import utils from "common/utils";
import { ChainStore } from "cybexjs";
import { connect } from "alt-react";
import MarketsStore from "stores/MarketsStore";
import SettingsStore from "stores/SettingsStore";
import { List } from "immutable";
import Translate from "react-translate-component";
import counterpart from "counterpart";
import { MarketStatsCheck } from "./EquivalentPrice";
import { isFootballAsset } from "qtb";

/**
 *  Given an asset amount, displays the equivalent value in baseAsset if possible
 *
 *  Expects three properties
 *  -'toAsset' which should be a asset id
 *  -'fromAsset' which is the asset id of the original asset amount
 *  -'amount' which is the amount to convert
 *  -'fullPrecision' boolean to tell if the amount uses the full precision of the asset
 */

let TotalValue = class extends MarketStatsCheck {
  static propTypes = {
    fromAssets: ChainTypes.ChainAssetsList.isRequired,
    toAsset: ChainTypes.ChainAsset.isRequired,
    coreAsset: ChainTypes.ChainAsset.isRequired,
    inHeader: PropTypes.bool,
    label: PropTypes.string
  };

  static defaultProps = {
    inHeader: false,
    label: "",
    coreAsset: "1.3.0"
  };

  constructor(props) {
    super(props);
  }

  shouldComponentUpdate(np) {
    return (
      super.shouldComponentUpdate(np) ||
      !utils.are_equal_shallow(np.fromAssets, this.props.fromAssets) ||
      np.toAsset !== this.props.toAsset ||
      !utils.are_equal_shallow(np.balances, this.props.balances) ||
      !utils.are_equal_shallow(np.openOrders, this.props.openOrders) ||
      !utils.are_equal_shallow(np.collateral, this.props.collateral) ||
      !utils.are_equal_shallow(np.debt, this.props.debt)
    );
  }

  _convertValue(amount, fromAsset, toAsset, marketStats, coreAsset) {
    if (!fromAsset || !toAsset) {
      return 0;
    }
    let toStats, fromStats;

    let toID = toAsset.get("id");
    let toSymbol = toAsset.get("symbol");
    let fromID = fromAsset.get("id");
    let fromSymbol = fromAsset.get("symbol");

    if (coreAsset && marketStats) {
      let coreSymbol = coreAsset.get("symbol");

      toStats = marketStats.get(toSymbol + "_" + coreSymbol);
      fromStats = marketStats.get(fromSymbol + "_" + coreSymbol);
    }

    let price = utils.convertPrice(
      fromStats && fromStats.close
        ? fromStats.close
        : fromID === "1.3.0" || fromAsset.has("bitasset")
          ? fromAsset
          : null,
      toStats && toStats.close
        ? toStats.close
        : toID === "1.3.0" || toAsset.has("bitasset")
          ? toAsset
          : null,
      fromID,
      toID
    );

    return price ? utils.convertValue(price, amount, fromAsset, toAsset) : 0;
  }

  _assetValues(totals, amount, asset) {
    if (!totals[asset]) {
      totals[asset] = amount;
    } else {
      totals[asset] += amount;
    }

    return totals;
  }

  render() {
    let {
      fromAssets: _formAssets,
      toAsset,
      balances,
      marketStats,
      collateral,
      debt,
      openOrders,
      inHeader
    } = this.props;
    let coreAsset = ChainStore.getAsset("1.3.0");

    if (!coreAsset || !toAsset) {
      return null;
    }
    let fromAssets = _formAssets.filter(
      asset => asset && !isFootballAsset(asset.get("symbol"))
    );
    let assets = {};
    fromAssets.forEach(asset => {
      if (asset) {
        assets[asset.get("id")] = asset;
      }
    });

    let totalValue = 0;
    let assetValues = {};

    // Collateral value
    for (let asset in collateral) {
      let fromAsset = assets[asset];
      // Hide For Wcup
      let fromAssetMap = ChainStore.getAsset(fromAsset);
      if (!fromAssetMap || isFootballAsset(fromAssetMap.get("symbol"))) {
        continue;
      }
      if (fromAsset) {
        let collateralValue = this._convertValue(
          collateral[asset],
          fromAsset,
          toAsset,
          marketStats,
          coreAsset
        );
        totalValue += collateralValue;
        assetValues = this._assetValues(
          assetValues,
          collateralValue,
          fromAsset.get("id")
        );
      }
    }

    // Open orders value
    for (let asset in openOrders) {
      let fromAsset = assets[asset];
      if (!fromAsset) {
        continue;
      };
      // Hide For Wcup
      let fromAssetMap = fromAsset.get
        ? fromAsset
        : ChainStore.getAsset(fromAsset);
      if (!fromAssetMap || isFootballAsset(fromAssetMap.get("symbol"))) {
        continue;
      }
      if (fromAsset) {
        let orderValue = this._convertValue(
          openOrders[asset],
          fromAsset,
          toAsset,
          marketStats,
          coreAsset
        );
        totalValue += orderValue;
        assetValues = this._assetValues(
          assetValues,
          orderValue,
          fromAsset.get("id")
        );
      }
    }

    // Debt value
    for (let asset in debt) {
      let fromAsset = assets[asset];
      if (!fromAsset) {
        continue;
      };
      // Hide For Wcup
      let fromAssetMap = ChainStore.getAsset(fromAsset);
      if (!fromAssetMap || isFootballAsset(fromAssetMap.get("symbol"))) {
        continue;
      }
      if (fromAsset) {
        let debtValue = this._convertValue(
          debt[asset],
          fromAsset,
          toAsset,
          marketStats,
          coreAsset
        );
        totalValue -= debtValue;
        assetValues = this._assetValues(
          assetValues,
          -debtValue,
          fromAsset.get("id")
        );
      }
    }

    // Balance value
    balances.forEach(balance => {
      let fromAsset = assets[balance.asset_id];
      if (!fromAsset) {
        return;
      };
      let fromAssetMap = ChainStore.getAsset(balance.asset_id);
      if (!fromAssetMap || isFootballAsset(fromAssetMap.get("symbol"))) {
        return;
      }
      if (fromAsset) {
        let eqValue =
          fromAsset !== toAsset
            ? this._convertValue(
                balance.amount,
                fromAsset,
                toAsset,
                marketStats,
                coreAsset
              )
            : balance.amount;
        totalValue += eqValue;
        assetValues = this._assetValues(
          assetValues,
          eqValue,
          fromAsset.get("id")
        );
      }
    });

    // Determine if higher precision should be displayed
    let hiPrec = false;
    for (let asset in assetValues) {
      if (assets[asset] && assetValues[asset]) {
        if (
          Math.abs(utils.get_asset_amount(assetValues[asset], toAsset)) < 100
        ) {
          hiPrec = true;
          break;
        }
      }
    }

    // Render each asset's balance, noting if there are any values missing
    const noDataSymbol = "**";
    const minValue = 1e-12;
    let missingData = false;
    let totalsTip = "<table><tbody>";
    for (let asset in assetValues) {
      if (assets[asset] && assetValues[asset]) {
        let symbol = utils.replaceName(assets[asset].get("symbol")).name;
        let amount = utils.get_asset_amount(assetValues[asset], toAsset);
        if (amount) {
          if (amount < minValue && amount > -minValue) {
            // really close to zero, but not zero, probably a result of incomplete data
            amount = noDataSymbol;
            missingData = true;
          } else if (hiPrec) {
            if (amount >= 0 && amount < 0.01) amount = "<0.01";
            else if (amount < 0 && amount > -0.01) amount = "-0.01<";
            else amount = utils.format_number(amount, 2);
          } else {
            if (amount >= 0 && amount < 1) amount = "<1";
            else if (amount < 0 && amount > -0.01) amount = "-1<";
            else amount = utils.format_number(amount, 0);
          }
        } else {
          amount = noDataSymbol;
          missingData = true;
        }
        totalsTip += `<tr><td>${symbol}:&nbsp;</td><td style="text-align: right;">${amount} ${toAsset.get(
          "symbol"
        )}</td></tr>`;
      }
    }

    // If any values are missing, let the user know.
    if (missingData)
      totalsTip += `<tr><td>&nbsp;</td><td style="text-align: right;">${noDataSymbol} no data</td></tr>`;

    totalsTip += '<tr><td colSpan="2">&nbsp;</td></tr>';
    totalsTip += `<tr><td colSpan="2">${counterpart.translate(
      "account.total_estimate"
    )}</td></tr>`;
    totalsTip += "</tbody></table>";

    if (!inHeader) {
      return (
        <span>
          {!!this.props.label ? (
            <span className="font-secondary">
              <Translate content={this.props.label} />:{" "}
            </span>
          ) : null}
          <FormattedAsset
            noTip={this.props.noTip}
            noPrefix
            hide_asset={this.props.hide_asset}
            amount={totalValue}
            asset={toAsset.get("id")}
            decimalOffset={
              toAsset.get("symbol").indexOf("BTC") === -1
                ? toAsset.get("precision") - 2
                : 4
            }
          />
        </span>
      );
    } else {
      return (
        <div
          className="tooltip inline-block"
          data-tip={totalsTip}
          data-place="bottom"
          data-html={true}
        >
          {!!this.props.label ? (
            <span className="font-secondary">
              <Translate content={this.props.label} />:{" "}
            </span>
          ) : null}
          <FormattedAsset
            noTip
            noPrefix
            hide_asset={this.props.hide_asset}
            amount={totalValue}
            asset={toAsset.get("id")}
            decimalOffset={
              toAsset.get("symbol").indexOf("BTC") === -1
                ? toAsset.get("precision") - 2
                : 4
            }
          />
        </div>
      );
    }
  }
};
TotalValue = BindToChainState(TotalValue, { keep_updating: true });

let ValueStoreWrapper = class extends React.Component<any, any> {
  render() {
    let preferredUnit = this.props.settings.get("unit") || "1.3.0";

    return <TotalValue {...this.props} toAsset={preferredUnit} />;
  }
};

ValueStoreWrapper = connect(
  ValueStoreWrapper,
  {
    listenTo() {
      return [MarketsStore, SettingsStore];
    },
    getProps() {
      return {
        marketStats: MarketsStore.getState().allMarketStats,
        settings: SettingsStore.getState().settings
      };
    }
  }
);

let TotalBalanceValue = class extends React.Component<any, any> {
  static propTypes = {
    balances: ChainTypes.ChainObjectsList
  };

  static defaultProps = {
    collateral: {},
    debt: {},
    openOrders: {}
  };

  render() {
    let { balances, collateral, debt, openOrders, inHeader } = this.props;
    let assets = List();
    let amounts = [];

    balances.forEach(balance => {
      if (balance) {
        assets = assets.push(balance.get("asset_type"));
        amounts.push({
          asset_id: balance.get("asset_type"),
          amount: parseInt(balance.get("balance"), 10)
        });
      }
    });

    for (let asset in collateral) {
      if (!assets.has(asset as any)) {
        assets = assets.push(asset);
      }
    }

    for (let asset in debt) {
      if (!assets.has(asset as any)) {
        assets = assets.push(asset);
      }
    }

    for (let asset in openOrders) {
      if (!assets.has(asset as any)) {
        assets = assets.push(asset);
      }
    }

    return (
      <ValueStoreWrapper
        label={this.props.label}
        hide_asset={this.props.hide_asset}
        noTip={this.props.noTip}
        inHeader={inHeader}
        balances={amounts}
        openOrders={openOrders}
        debt={debt}
        collateral={collateral}
        fromAssets={assets}
      />
    );
  }
};
TotalBalanceValue = BindToChainState(TotalBalanceValue, {
  keep_updating: true
});

let AccountWrapper = class extends React.Component<any, any> {
  static propTypes = {
    accounts: ChainTypes.ChainAccountsList.isRequired
  };

  shouldComponentUpdate(nextProps) {
    return !utils.are_equal_shallow(nextProps.accounts, this.props.accounts);
  }

  render() {
    let balanceList = List(),
      collateral = {},
      debt = {},
      openOrders = {};

    this.props.accounts.forEach(account => {
      if (account) {
        account.get("orders") &&
          account.get("orders").forEach((orderID, key) => {
            let order = ChainStore.getObject(orderID);
            if (order) {
              let orderAsset = order.getIn(["sell_price", "base", "asset_id"]);
              if (!openOrders[orderAsset]) {
                openOrders[orderAsset] = parseInt(order.get("for_sale"), 10);
              } else {
                openOrders[orderAsset] += parseInt(order.get("for_sale"), 10);
              }
            }
          });

        account.get("call_orders") &&
          account.get("call_orders").forEach((callID, key) => {
            let position = ChainStore.getObject(callID);
            if (position) {
              let collateralAsset = position.getIn([
                "call_price",
                "base",
                "asset_id"
              ]);
              if (!collateral[collateralAsset]) {
                collateral[collateralAsset] = parseInt(
                  position.get("collateral"),
                  10
                );
              } else {
                collateral[collateralAsset] += parseInt(
                  position.get("collateral"),
                  10
                );
              }
              let debtAsset = position.getIn([
                "call_price",
                "quote",
                "asset_id"
              ]);
              if (!debt[debtAsset]) {
                debt[debtAsset] = parseInt(position.get("debt"), 10);
              } else {
                debt[debtAsset] += parseInt(position.get("debt"), 10);
              }
            }
          });

        let account_balances = account.get("balances");
        account_balances &&
          account_balances.forEach(balance => {
            let balanceAmount = ChainStore.getObject(balance);
            if (!balanceAmount || !balanceAmount.get("balance")) {
              return null;
            }
            balanceList = balanceList.push(balance);
          });
      }
    });

    if (
      !balanceList.size &&
      !Object.keys(openOrders).length &&
      !Object.keys(debt).length
    ) {
      return (
        <span>
          {" "}
          0
        </span>
      );
    } else {
      return (
        <TotalBalanceValue
          label={this.props.label}
          inHeader={this.props.inHeader}
          balances={balanceList}
          openOrders={openOrders}
          debt={debt}
          collateral={collateral}
        />
      );
    }
  }
};
AccountWrapper = BindToChainState(AccountWrapper, { keep_updating: true });

(TotalBalanceValue as any).AccountWrapper = AccountWrapper;
export default TotalBalanceValue;
