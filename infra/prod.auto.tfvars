# production values consumed by CI on every terraform run.
# nothing here is a secret -- ed25519 public keys are safe to publish, and
# the acme email is on the LE cert anyway. real secrets (postgres password,
# ssh private key) never appear in this file -- they live in tf state (GCS)
# and GH Actions secrets respectively.

acme_email = "ayoub.abid@insat.u-carthage.tn"

ssh_pub_keys = [
  "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIKfEXIlBHMHlyWIaSXkpMOhPkkEKzKH6RkKBGf95XPLK kamka-tasks-ci-deploy",
  "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAINA8xpLJyP7ZPb2mTU7vssu4tJXCE/Nd544nhdG5Ur/D souassi",
]
