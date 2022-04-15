import { prisma } from "db"
import { generateToken, hash256 } from "@blitzjs/auth"
import { forgotPasswordMailer } from "mailers/forgotPasswordMailer"
import { ForgotPassword } from "../validations"
import { Ctx } from "@blitzjs/next"

const RESET_PASSWORD_TOKEN_EXPIRATION_IN_HOURS = 4

export default async function forgotPassword(input, ctx: Ctx) {
  ForgotPassword.parse(input)
  // 1. Get the user
  const user = await prisma.user.findFirst({ where: { email: input.email.toLowerCase() } })

  // 2. Generate the token and expiration date.
  const token = generateToken()
  const hashedToken = hash256(token)
  const expiresAt = new Date()
  expiresAt.setHours(expiresAt.getHours() + RESET_PASSWORD_TOKEN_EXPIRATION_IN_HOURS)

  // 3. If user with this email was found
  if (user) {
    // 4. Delete any existing password reset tokens
    await prisma.token.deleteMany({ where: { type: "RESET_PASSWORD", userId: user.id } })
    // 5. Save this new token in the database.
    await prisma.token.create({
      data: {
        user: { connect: { id: user.id } },
        type: "RESET_PASSWORD",
        expiresAt,
        hashedToken,
        sentTo: user.email,
      },
    })
    // 6. Send the email
    await forgotPasswordMailer({ to: user.email, token }).send()
  } else {
    // 7. If no user found wait the same time so attackers can't tell the difference
    await new Promise((resolve) => setTimeout(resolve, 750))
  }

  // 8. Return the same result whether a password reset email was sent or not
  return
}
