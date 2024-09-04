# Use an official Node runtime as the parent image
FROM node:20

# Set the working directory in the container
WORKDIR /app

# Install Yarn 4 globally
RUN corepack enable && corepack prepare yarn@stable --activate

# Copy package.json and yarn.lock
COPY package.json yarn.lock ./

# Copy .yarnrc.yml if it exists
COPY .yarnrc.yml* ./

# Install dependencies with increased network timeout
RUN yarn install --network-timeout 100000

# Copy the rest of the application code
COPY . .

# Run Prisma generate (this will be handled by postinstall script)
RUN yarn postinstall

# Build the application
RUN yarn build

# Expose the port the app runs on
EXPOSE 8080

# Set NODE_ENV to production
ENV NODE_ENV=production

# Define the command to run the app
CMD ["yarn", "start"]