import * as React from "react";
import styled from "styled-components";
import WalletConnect from "@walletconnect/browser";
import Button from "./components/Button";
import Card from "./components/Card";
import Input from "./components/Input";
import Header from "./components/Header";
import Column from "./components/Column";
import PeerMeta from "./components/PeerMeta";
import DisplayRequest from "./components/DisplayRequest";
import RequestButton from "./components/RequestButton";
import { convertUtf8ToHex } from "@walletconnect/utils";
import QRCodeScanner from './components/QRCodeScanner';
import {
  getMultipleAccounts
} from "./helpers/wallet";
import { apiGetCustomRequest } from "./helpers/api";

const SContainer = styled.div`
  display: flex;
  flex-direction: column;

  width: 100%;
  min-height: 100%;
  max-width: 600px;
  margin: 0 auto;
  padding: 0;
`;


const SContent = styled.div`
  width: 100%;
  flex: 1;
  padding: 30px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
`;

const STitle = styled.h1`
  margin: 10px auto;
  text-align: center;
  font-size: calc(10px + 2vmin);
`;

const SActions = styled.div`
  margin: 0;
  margin-top: 20px;

  display: flex;
  justify-content: space-around;
  & > * {
    margin: 0 5px;
  }
`;

const SActionsColumn = styled(SActions)`
  flex-direction: row;
  align-items: center;

  & > p {
    font-weight: 600;
  }
`;

const SButton = styled(Button)`
  width: 50%;
  height: 40px;
`;

const SInput = styled(Input)`
  width: 50%;
  margin: 10px;
  font-size: 14px;
  height: 40px;
`;

const SConnectedPeer = styled.div`
  display: flex;
  align-items: center;
  & img {
    width: 40px;
    height: 40px;
  }
  & > div {
    margin-left: 10px;
  }
`;

const SRequestButton = styled(RequestButton)`
  margin-bottom: 10px;
`;

interface IAppState {
  loading: boolean;
  scanner: boolean;
  walletConnector: WalletConnect | null;
  uri: string;
  peerMeta: {
    description: string;
    url: string;
    icons: string[];
    name: string;
    ssl: boolean;
  };
  connected: boolean;
  chainId: number;
  accounts: string[];
  activeIndex: number;
  address: string;
  requests: any[];
  results: any[];
  displayRequest: any;
  pendingRequest: any;
}

const defaultChainId = 3;

const TEST_ACCOUNTS = getMultipleAccounts();

const INITIAL_STATE = {
  loading: false,
  scanner: false,
  walletConnector: null,
  uri: "",
  peerMeta: {
    description: "",
    url: "",
    icons: [],
    name: "",
    ssl: false
  },
  connected: false,
  chainId: defaultChainId,
  accounts: TEST_ACCOUNTS,
  address: TEST_ACCOUNTS[0],
  activeIndex: 0,
  requests: [],
  results: [],
  displayRequest: null,
  pendingRequest: false
};

const signingMethods = [
  "eth_sendTransaction",
  "eth_signTransaction",
  "personal_sign",
  "eth_sign",
  "eth_signTypedData"
];

class App extends React.Component<{}> {
  public state: IAppState;

  constructor(props: any) {
    super(props);
    this.state = {
      ...INITIAL_STATE
    };
  }
  public componentDidMount() {
    this.initWallet();
  }

  public initWallet = async () => {
    const local = localStorage ? localStorage.getItem("walletconnect") : null;
    console.log(this.state)

    if (local) {
      let session;

      try {
        session = JSON.parse(local);
      } catch (error) {
        throw error;
      }

      const walletConnector = new WalletConnect({ session });

      const { connected, chainId, accounts, peerMeta } = walletConnector;

      const address = accounts[0];

      const activeIndex = accounts.indexOf(address);

     // await updateWallet(activeIndex, chainId);

      await this.setState({
        connected,
        walletConnector,
        address,
        activeIndex,
        accounts,
        chainId,
        peerMeta
      });

      console.log(this.state)

      this.subscribeToEvents();
    }
  };


  public initWalletConnect = async () => {
    const { uri } = this.state;

    this.setState({ loading: true });

    try {
      const walletConnector = new WalletConnect({ uri });

      window.walletConnector = walletConnector; // tslint:disable-line

      if (!walletConnector.connected) {
        await walletConnector.createSession();
      }

      await this.setState({
        loading: false,
        walletConnector,
        uri: walletConnector.uri
      });


      this.subscribeToEvents();
      console.log(this.state)

    } catch (error) {
      this.setState({ loading: false });

      throw error;
    }
  };

  public approveSession = () => {
    const { walletConnector, chainId, address } = this.state;
    if (walletConnector) {
      walletConnector.approveSession({ chainId, accounts: [address] });
    }
    this.setState({ walletConnector });
  };

  public rejectSession = () => {
    const { walletConnector } = this.state;
    if (walletConnector) {
      walletConnector.rejectSession();
    }
    this.setState({ walletConnector });
  };

  public killSession = () => {
    const { walletConnector } = this.state;
    if (walletConnector) {
      walletConnector.killSession();
    }
    this.resetApp();
  };

  public resetApp = async () => {
    await this.setState({ ...INITIAL_STATE });
    this.initWallet();
  };

  public subscribeToEvents = () => {
    const { walletConnector } = this.state;

    if (walletConnector) {
      walletConnector.on("session_request", (error, payload) => {
        console.log('walletConnector.on("session_request")'); // tslint:disable-line

        if (error) {
          throw error;
        }

        const { peerMeta } = payload.params[0];
        this.setState({ peerMeta });
      });

      walletConnector.on("session_update", (error, payload) => {
        console.log('walletConnector.on("session_update")'); // tslint:disable-line

        if (error) {
          throw error;
        }
      });

      walletConnector.on("call_request", (error, payload) => {
        console.log('walletConnector.on("call_request")'); // tslint:disable-line

        if (error) {
          throw error;
        }

        if (!signingMethods.includes(payload.method)) {
          const { chainId } = this.state;
          apiGetCustomRequest(chainId, payload)
            .then(result =>
              walletConnector.approveRequest({
                id: payload.id,
                result
              })
            )
            .catch(() =>
              walletConnector.rejectRequest({
                id: payload.id,
                error: { message: "JSON RPC method not supported" }
              })
            );
          return;
        }

        const requests = [...this.state.requests, payload];
        this.setState({ requests });
      });

      walletConnector.on("connect", (error, payload) => {
        console.log('walletConnector.on("connect")'); // tslint:disable-line

        if (error) {
          throw error;
        }

        this.setState({ connected: true });
      });

      walletConnector.on("disconnect", (error, payload) => {
        console.log('walletConnector.on("disconnect")'); // tslint:disable-line

        if (error) {
          throw error;
        }

        this.resetApp();
      });

      if (walletConnector.connected) {
        const { chainId, accounts } = walletConnector;
        console.log(chainId,accounts)
        const address = accounts[0] as any;
        // updateWallet(address, chainId);
        this.setState({
          connected: true,
          address,
          chainId
        });
      }

      this.setState({ walletConnector });
    }
  };

  public updateSession = async (sessionParams: {
    chainId?: number;
    activeIndex?: number;
  }) => {
    const { walletConnector, chainId, accounts, activeIndex } = this.state;
    const _chainId = sessionParams.chainId || chainId;
    const _activeIndex = sessionParams.activeIndex || activeIndex;
    const address = accounts[_activeIndex];
    if (walletConnector) {
      walletConnector.updateSession({
        chainId: _chainId,
        accounts: [address]
      });
    }

    await this.setState({
      walletConnector,
      chainId: _chainId,
      address
    });
  };

  public updateChain = async (chainId: number | string) => {
    //const { activeIndex } = this.state;
    const _chainId = Number(chainId);
    //await updateWallet(activeIndex, _chainId);
    await this.updateSession({ chainId: _chainId });
  };

  public updateAddress = async (activeIndex: number) => {
    //const { chainId } = this.state;
    //await updateWallet(activeIndex, chainId);
    await this.updateSession({ activeIndex });
  };

  public toggleScanner = () => {
    this.setState({ scanner: !this.state.scanner });
  };

  public onQRCodeValidate = (data: string): any => {
    const res: any = {
      error: null,
      result: null
    };
    try {
      res.result = data;
    } catch (error) {
      res.error = error;
    }

    return res;
  };

  public onQRCodeScan = async (data: any) => {
    const uri = typeof data === "string" ? data : "";
    if (uri) {
      await this.setState({ uri });
      await this.initWalletConnect();
      this.toggleScanner();
    }
  };

  public onURIPaste = async (e: any) => {
    const data = e.target.value;
    const uri = typeof data === "string" ? data : "";
    if (uri) {
      await this.setState({ uri });
      await this.initWalletConnect();
    }
  };

  public onQRCodeError = (error: Error) => {
    throw error;
  };

  public onQRCodeClose = () => this.toggleScanner();

  public openRequest = (request: any) =>
    this.setState({ displayRequest: request });

  public closeRequest = async () => {
    const { requests, displayRequest } = this.state;
    const filteredRequests = requests.filter(
      request => request.id !== displayRequest.id
    );
    await this.setState({
      requests: filteredRequests,
      displayRequest: null
    });
  };

  public testSignPersonalMessage = async () => {
    const { walletConnector, address } = this.state;

    if (!walletConnector) {
      return;
    }

    // test message
    const message = "Hello web wallet";

    // encode message (hex)
    const hexMsg = convertUtf8ToHex(message);

    // personal_sign params
    const msgParams = [hexMsg, address];

    try {
      // open modal

      // toggle pending request indicator
      this.setState({ pendingRequest: true });

      // send message
      const result = await walletConnector.signPersonalMessage(msgParams);
      console.log(walletConnector);
      
      // format displayed result
      const formattedResult = {
        method: "personal_sign",
        address,
        result
      };

      // display result
      this.setState({
        walletConnector,
        pendingRequest: false,
        result: formattedResult || null
      });
    } catch (error) {
      console.error(error); // tslint:disable-line
      this.setState({ walletConnector, pendingRequest: false, result: null });
    }
  };

  public render() {
    const {
      peerMeta,
      scanner,
      connected,
      address,
      chainId,
      requests,
      displayRequest,
      pendingRequest
    } = this.state;
    return (
      <React.Fragment>
        <SContainer>
          <Header
            connected={connected}
            address={address}
            chainId={chainId}
            killSession={this.killSession}
          />
          <SContent>
            <Card maxWidth={400}>
              <STitle>{`Wallet`}</STitle>
              {!connected ? (
                peerMeta && peerMeta.name ? (
                  <Column>
                    <PeerMeta peerMeta={peerMeta} />
                    <SActions>
                      <Button onClick={this.approveSession}>{`Approve`}</Button>
                      <Button onClick={this.rejectSession}>{`Reject`}</Button>
                    </SActions>
                  </Column>
                ) : (
                  <Column>
                    <SActionsColumn>
                      <SButton onClick={this.toggleScanner}>{`Scan`}</SButton>
                      <p>{"OR"}</p>
                      <SInput
                        onChange={this.onURIPaste}
                        placeholder={"Paste wc: uri"}
                      />
                    </SActionsColumn>
                  </Column>
                )
              ) : !displayRequest ? (
                <Column>
                  {peerMeta && peerMeta.name && (
                    <>
                      <h6>{"Connected to"}</h6>
                      <SConnectedPeer>
                        <img src={peerMeta.icons[0]} alt={peerMeta.name} />
                        <div>{peerMeta.name}</div>
                      </SConnectedPeer>
                    </>
                  )}
                  <h6>{"Pending Call Requests"}</h6>
                  {!!requests.length ? (
                    requests.map(request => (
                      <SRequestButton
                        key={request.id}
                        onClick={() => this.openRequest(request)}
                      >
                        <div>{request.method}</div>
                      </SRequestButton>
                    ))
                  ) : (
                    <>
                    <div>
                      <div>{"No pending requests"}</div>
                    </div>
                    <div>
                    </div>
                    <div>
                      <h6>{"Send Request"}</h6>
                      <SRequestButton
                        onClick={() => this.testSignPersonalMessage()}
                      >
                        <div>{'Send Personal Request'}</div>
                      </SRequestButton>
                      {
                        pendingRequest && (
                          <div>{'request sent'}</div>
                        )
                      }                      
                    </div>
                    </>
                  )}
                </Column>
              ) : (
                <DisplayRequest
                  displayRequest={displayRequest}
                  peerMeta={peerMeta}
                  closeRequest={this.closeRequest}
                />
              )}
            </Card>
          </SContent>
          {scanner && (
            <QRCodeScanner
              onValidate={this.onQRCodeValidate}
              onScan={this.onQRCodeScan}
              onError={this.onQRCodeError}
              onClose={this.onQRCodeClose}
            />
          )}
        </SContainer>
      </React.Fragment>
    );
  }
}

export default App;
