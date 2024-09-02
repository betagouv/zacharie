# Use an official Node runtime as the parent image
FROM node:20

# Set the working directory in the container
WORKDIR /app

# Copy package.json, yarn.lock, and .yarnrc.yml
COPY package.json yarn.lock .yarnrc.yml ./

# Install Yarn 4
RUN corepack enable && corepack prepare yarn@stable --activate

# Install dependencies
RUN yarn install

# Copy the rest of the application code
COPY . .

# Build the application
RUN yarn build

# Expose the port the app runs on
EXPOSE 8080

# Define the command to run the app
CMD ["yarn", "start"]