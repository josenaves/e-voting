import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from '@solana/web3.js'
import { EVoting } from "../target/types/e_voting";
import { assert, expect } from "chai";

const PROPOSAL_SEED = "evoting_proposal_seed";
const VOTE_SEED = "evoting_vote_seed";

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

  console.log("program.programId", program.programId);
  console.log("admin", admin.publicKey);
  console.log("joe", joe.publicKey);
  console.log("juliana", juliana.publicKey);

  before("prepare", async () => {
    await airdrop(anchor.getProvider().connection, admin.publicKey);
    await airdrop(anchor.getProvider().connection, joe.publicKey);
    await airdrop(anchor.getProvider().connection, juliana.publicKey);
  })

  it("Proposal cannot have large description (greater than 50)", async () => {
    let veryLargeDescription = "Very large description that will break the program!";

    const [proposalPDA] = getProposalAddress(veryLargeDescription, admin.publicKey, program.programId);
    console.log("proposalPDA", proposalPDA);

    let should_fail = "This Should Fail"
    try {
      await program.methods
        .create(veryLargeDescription)
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
    const [proposalPDA] = getProposalAddress(DESCRIPTION_1, admin.publicKey, program.programId);
    console.log("proposalPDA", proposalPDA);

    const tx = await program.methods
      .create(DESCRIPTION_1)
      .accounts({
        user: admin.publicKey,
        proposal: proposalPDA,
        systemProgram: SystemProgram.programId
      })
      .signers([admin])
      .rpc({ commitment: "confirmed" });

    console.log("Your transaction signature", tx);

    let proposal = await program.account.proposal.fetch(proposalPDA);
    console.log("Proposal", proposal);

    expect(proposal.description).to.equal(DESCRIPTION_1);
    expect(proposal.noVotes).to.equal(0);
    expect(proposal.yesVotes).to.equal(0);
    expect(proposal.ongoing).to.equal(true);
  });


  it("Proposal creation #2", async () => {
    const [proposalPDA] = getProposalAddress(DESCRIPTION_2, admin.publicKey, program.programId);
    console.log("proposalPDA", proposalPDA);

    const tx = await program.methods
      .create(DESCRIPTION_2)
      .accounts({
        user: admin.publicKey,
        proposal: proposalPDA,
        systemProgram: SystemProgram.programId
      })
      .signers([admin])
      .rpc({ commitment: "confirmed" });

    console.log("Your transaction signature", tx);

    let proposal = await program.account.proposal.fetch(proposalPDA);
    console.log("Proposal", proposal);

    expect(proposal.description).to.equal(DESCRIPTION_2);
    expect(proposal.noVotes).to.equal(0);
    expect(proposal.yesVotes).to.equal(0);
    expect(proposal.ongoing).to.equal(true);
  });

  it("Joe is voting yes", async () => {
    let [proposalPDA] = getProposalAddress(DESCRIPTION_1, admin.publicKey, program.programId);
    console.log("proposalPDA", proposalPDA);

    let [votePDA] = getVoteAddress(joe.publicKey, proposalPDA, program.programId);
    console.log("votePDA", votePDA);

    console.log("joe.publicKey", joe.publicKey);
    console.log("SystemProgram.programId", SystemProgram.programId);

    const tx = await program.methods
      .voteYes(DESCRIPTION_1)
      .accounts({
        user: joe.publicKey,
        proposal: proposalPDA,
        vote: votePDA,
        systemProgram: SystemProgram.programId,
      })
      .signers([joe])
      // .rpc({ commitment: "confirmed" });
      .rpc({ skipPreflight: true});

    console.log("Your transaction signature", tx);

    // let proposal = await program.account.proposal.fetch(proposalPDA);
    // console.log("Proposal", proposal);

    // let vote = await program.account.vote.fetch(votePDA);
    // console.log("Vote", vote);
  });

//   it("Juliana is voting no", async () => {
//     let [proposalPDA] = getProposalAddress(admin.publicKey, program.programId);
//     console.log("proposalPDA", proposalPDA);

//     let [votePDA] = getVoteAddress(juliana.publicKey, proposalPDA, program.programId);
//     console.log("votePDA", votePDA);
// 4
//     const tx = await program.methods
//       .voteNo()
//       .accounts({
//         user: juliana.publicKey,
//         proposal: proposalPDA,
//         vote: votePDA,
//         systemProgram: SystemProgram.programId
//       })
//       .signers([juliana])
//       // .rpc({ commitment: "confirmed" });
//       .rpc({ skipPreflight: true});

//     console.log("Your transaction signature", tx);

//     let proposal = await program.account.proposal.fetch(proposalPDA);
//     console.log("Proposal", proposal);

//     let vote = await program.account.vote.fetch(votePDA);
//     console.log("Vote", vote);
//   });

});

function getProposalAddress(description: String, author: PublicKey, programID: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from(description),
      Buffer.from(PROPOSAL_SEED),
      author.toBuffer()
    ], 
    programID
  );
}

function getVoteAddress(author: PublicKey, proposal: PublicKey, programID: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from(VOTE_SEED),
      author.toBuffer(),
      proposal.toBuffer(),
    ], 
    programID
  );
}

async function airdrop(connection: any, address: any, amount = 1000000000) {
  await connection.confirmTransaction(await connection.requestAirdrop(address, amount), "confirmed");
}
