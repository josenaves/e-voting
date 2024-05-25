import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey } from '@solana/web3.js'
import { EVoting } from "../target/types/e_voting";
import { assert, expect } from "chai";

const EVOTING_SEED = "evoting";
const DESCRIPTION = "Proposal #1";

describe("e-voting system", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider);

  const program = anchor.workspace.EVoting as Program<EVoting>;

  const [proposalPDA, _] = PublicKey.findProgramAddressSync(
    [
      anchor.utils.bytes.utf8.encode(EVOTING_SEED),
      provider.wallet.publicKey.toBuffer(),
    ],
    program.programId
  )

  it("Proposal creation", async () => {
    const tx = await program.methods
      .create(DESCRIPTION)
      .accounts({
        user: provider.wallet.publicKey,
        proposal: proposalPDA,
      })
      .rpc();

    console.log("Your transaction signature", tx);

    let proposal = await program.account.proposal.fetch(proposalPDA);
    console.log("Proposal", proposal);

    expect(proposal.description).to.equal(DESCRIPTION);
    expect(proposal.noVotes).to.equal(0);
    expect(proposal.yesVotes).to.equal(0);
    expect(proposal.ongoing).to.equal(true);
  });
});