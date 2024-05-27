import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from '@solana/web3.js'
import { EVoting } from "../target/types/e_voting";
import { assert, expect } from "chai";

const DESCRIPTION_1 = "Proposal #1";
const DESCRIPTION_2 = "Proposal #2";

describe("e-voting system", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider);

  const program = anchor.workspace.EVoting as Program<EVoting>;

  const admin = anchor.web3.Keypair.generate();
  const joe = anchor.web3.Keypair.generate();
  const juliana = anchor.web3.Keypair.generate();
  const neto = anchor.web3.Keypair.generate();

  before("prepare", async () => {
    await airdrop(anchor.getProvider().connection, admin.publicKey);
    await airdrop(anchor.getProvider().connection, joe.publicKey);
    await airdrop(anchor.getProvider().connection, juliana.publicKey);
    await airdrop(anchor.getProvider().connection, neto.publicKey);
  })

  it("Proposal cannot have large description (greater than 50)", async () => {
    let veryLargeDescription = "Very large description that will break the program!";

    const [proposalPDA] = getProposalAddress(0, admin.publicKey, program.programId);

    let should_fail = "This Should Fail"
    try {
      await program.methods
        .create(0, veryLargeDescription)
        .accounts({
          user: admin.publicKey,
          proposal: proposalPDA,
          systemProgram: anchor.web3.SystemProgram.programId
        })
        .signers([admin])
        .rpc({ commitment: "confirmed" });
    } catch (error) {
      const err = anchor.AnchorError.parse(error.logs);
      assert.strictEqual(err.error.errorCode.code, "DescriptionTooLong");
      should_fail = "Failed"
    }
    assert.strictEqual(should_fail, "Failed")
  });

  it("Proposal creation #1", async () => {
    const [proposalPDA] = getProposalAddress(1, admin.publicKey, program.programId);
    const tx = await program.methods
      .create(1, DESCRIPTION_1)
      .accounts({
        user: admin.publicKey,
        proposal: proposalPDA,
        systemProgram: SystemProgram.programId
      })
      .signers([admin])
      .rpc({ commitment: "confirmed" });

    const proposal = await program.account.proposal.fetch(proposalPDA);

    expect(proposal.description).to.equal(DESCRIPTION_1);
    expect(proposal.noVotes).to.equal(0);
    expect(proposal.yesVotes).to.equal(0);
    expect(proposal.ongoing).to.equal(true);
  });

  it("Proposal creation #2", async () => {
    const [proposalPDA] = getProposalAddress(2, admin.publicKey, program.programId);
    const tx = await program.methods
      .create(2, DESCRIPTION_2)
      .accounts({
        user: admin.publicKey,
        proposal: proposalPDA,
        systemProgram: SystemProgram.programId
      })
      .signers([admin])
      .rpc({ commitment: "confirmed" });

    const proposal = await program.account.proposal.fetch(proposalPDA);

    expect(proposal.description).to.equal(DESCRIPTION_2);
    expect(proposal.noVotes).to.equal(0);
    expect(proposal.yesVotes).to.equal(0);
    expect(proposal.ongoing).to.equal(true);
  });

  it("Joe is voting yes (proposal #1)", async () => {
    const [proposalPDA] = getProposalAddress(1, admin.publicKey, program.programId);
    const [votePDA] = getVoteAddress(joe.publicKey, proposalPDA, program.programId);
    const tx = await program.methods
      .voteYes()
      .accounts({
        user: joe.publicKey,
        proposal: proposalPDA,
        vote: votePDA,
        systemProgram: SystemProgram.programId,
      })
      .signers([joe])
      .rpc({ commitment: "confirmed" });

    const proposal = await program.account.proposal.fetch(proposalPDA);
    const vote = await program.account.vote.fetch(votePDA);

    expect(proposal.yesVotes).to.equal(1);
    expect(proposal.noVotes).to.equal(0);
  });

  it("Juliana is voting no (proposal #1)", async () => {
    const [proposalPDA] = getProposalAddress(1, admin.publicKey, program.programId);
    const [votePDA] = getVoteAddress(juliana.publicKey, proposalPDA, program.programId);
    const tx = await program.methods
      .voteNo()
      .accounts({
        user: juliana.publicKey,
        proposal: proposalPDA,
        vote: votePDA,
        systemProgram: SystemProgram.programId
      })
      .signers([juliana])
      .rpc({ commitment: "confirmed" });

    const proposal = await program.account.proposal.fetch(proposalPDA);
    const vote = await program.account.vote.fetch(votePDA);

    expect(proposal.yesVotes).to.equal(1);
    expect(proposal.noVotes).to.equal(1);
  });

  it("Neto is voting no (proposal #1)", async () => {
    const [proposalPDA] = getProposalAddress(1, admin.publicKey, program.programId);
    const [votePDA] = getVoteAddress(neto.publicKey, proposalPDA, program.programId);
    const tx = await program.methods
      .voteNo()
      .accounts({
        user: neto.publicKey,
        proposal: proposalPDA,
        vote: votePDA,
        systemProgram: SystemProgram.programId
      })
      .signers([neto])
      .rpc({ commitment: "confirmed" });

    const proposal = await program.account.proposal.fetch(proposalPDA);
    const vote = await program.account.vote.fetch(votePDA);

    expect(proposal.yesVotes).to.equal(1);
    expect(proposal.noVotes).to.equal(2);
  });

});

function getProposalAddress(pid: number, author: PublicKey, programID: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("proposal"),
      author.toBuffer(),
      Buffer.from([pid])
    ], 
    programID
  );
}

function getVoteAddress(author: PublicKey, proposal: PublicKey, programID: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("vote"),
      proposal.toBuffer(),
      author.toBuffer(),
    ], 
    programID
  );
}

async function airdrop(connection: any, address: any, amount = 1000000000) {
  await connection.confirmTransaction(await connection.requestAirdrop(address, amount), "confirmed");
}
